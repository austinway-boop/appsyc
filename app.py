"""
Flask application for the AP Psychology FRQ Grader.
Two-part workflow: (1) enter rubric, (2) enter question + upload student files.
"""

import csv
import io
import json
import os
import traceback

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, Response

from file_processor import is_supported, process_file
from grader import grade_all_responses

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB upload limit


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/grade", methods=["POST"])
def grade():
    """
    Accepts multipart form data:
      - rubric_text: the scoring rubric (string)
      - question_text: the FRQ question/prompt (string)
      - rubric_file: optional rubric uploaded as a file
      - files[]: one or more student response files
    """
    rubric_text = request.form.get("rubric_text", "").strip()
    question_text = request.form.get("question_text", "").strip()

    if request.files.get("rubric_file"):
        rubric_file = request.files["rubric_file"]
        if rubric_file.filename:
            rubric_bytes = rubric_file.read()
            try:
                rubric_data = process_file(rubric_bytes, rubric_file.filename)
                if rubric_data["type"] == "text" and rubric_data["content"]:
                    rubric_text = rubric_data["content"]
                elif rubric_data["type"] == "image":
                    return jsonify({"error": "Rubric must be a text-based file (TXT, PDF, or DOCX), not an image."}), 400
            except Exception as e:
                return jsonify({"error": f"Failed to process rubric file: {e}"}), 400

    if not rubric_text:
        return jsonify({"error": "Please provide a scoring rubric (paste text or upload a file)."}), 400
    if not question_text:
        return jsonify({"error": "Please provide the FRQ question/prompt."}), 400

    student_files = request.files.getlist("files[]")
    if not student_files or all(not f.filename for f in student_files):
        return jsonify({"error": "Please upload at least one student response file."}), 400

    responses = []
    for f in student_files:
        if not f.filename:
            continue
        if not is_supported(f.filename):
            return jsonify({"error": f"Unsupported file type: {f.filename}. Supported: TXT, MD, PDF, DOCX, JPG, PNG."}), 400
        try:
            file_bytes = f.read()
            processed = process_file(file_bytes, f.filename)
            responses.append(processed)
        except Exception as e:
            return jsonify({"error": f"Failed to process {f.filename}: {e}"}), 400

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return jsonify({"error": "Anthropic API key not configured. Set ANTHROPIC_API_KEY in .env file."}), 500

    try:
        results = grade_all_responses(rubric_text, question_text, responses, api_key)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Grading failed: {e}"}), 500

    return jsonify({"results": results})


@app.route("/export-csv", methods=["POST"])
def export_csv():
    """Export grading results as a CSV file."""
    data = request.get_json()
    if not data or "results" not in data:
        return jsonify({"error": "No results to export."}), 400

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Student File", "Part", "Points Earned", "Points Possible", "Justification"])

    for result in data["results"]:
        student = result.get("student_file", "unknown")
        for part in result.get("parts", []):
            writer.writerow([
                student,
                part.get("part", ""),
                part.get("points_earned", 0),
                part.get("points_possible", 0),
                part.get("justification", ""),
            ])
        writer.writerow([
            student,
            "TOTAL",
            result.get("total_score", 0),
            result.get("max_score", 0),
            result.get("overall_feedback", ""),
        ])
        writer.writerow([])

    csv_content = output.getvalue()
    return Response(
        csv_content,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=grading_results.csv"},
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
