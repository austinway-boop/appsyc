"""
Flask application for the AP Psychology FRQ Grader.
Four-step workflow: rubric, reference material, questions, student responses.
"""

import csv
import io
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


def _extract_text_field(form_key, file_key, label):
    """Extract text from a form field, falling back to an uploaded file."""
    text = request.form.get(form_key, "").strip()

    if request.files.get(file_key):
        uploaded = request.files[file_key]
        if uploaded.filename:
            file_bytes = uploaded.read()
            data = process_file(file_bytes, uploaded.filename)
            if data["type"] == "text" and data["content"]:
                text = data["content"]
            elif data["type"] == "image":
                return None, f"{label} must be a text-based file (TXT, MD, PDF, or DOCX), not an image."

    return text, None


@app.route("/grade", methods=["POST"])
def grade():
    rubric_text, err = _extract_text_field("rubric_text", "rubric_file", "Rubric")
    if err:
        return jsonify({"error": err}), 400
    if not rubric_text:
        return jsonify({"error": "Please provide a scoring rubric."}), 400

    reference_text, err = _extract_text_field("reference_text", "reference_file", "Reference material")
    if err:
        return jsonify({"error": err}), 400

    question_text = request.form.get("question_text", "").strip()
    if not question_text:
        return jsonify({"error": "Please provide the FRQ questions."}), 400

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

    api_key = os.environ.get("CLAUDE")
    if not api_key:
        return jsonify({"error": "Anthropic API key not configured. Set CLAUDE environment variable."}), 500

    try:
        results = grade_all_responses(rubric_text, reference_text or "", question_text, responses, api_key)
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
