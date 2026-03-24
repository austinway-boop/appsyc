"""
AP Psychology FRQ Grading Engine.
Uses Claude Opus 4.6 with adaptive thinking to grade student responses
point-by-point against an official rubric.
"""

import json
import os
from typing import List, Optional

import anthropic

MODEL = "claude-opus-4-6"

AP_PSYCH_SYSTEM_PROMPT = """You are an expert AP Psychology FRQ grader. You have been trained exactly as College Board readers are trained: you AWARD points rather than deduct them. Each scoring point is binary (0 or 1) and independent of every other point.

## YOUR TASK

You will receive:
1. The official scoring rubric for this FRQ
2. The reference material / source article that students read (if provided)
3. The FRQ question/prompt
4. A single student's response

Grade the student's response strictly against the provided rubric, point by point.

## THE 5 UNIVERSAL AP PSYCHOLOGY SCORING RULES

You MUST follow these rules on every response you grade:

**Rule 1 — Spelling and grammar never reduce scores.**
"Answers must be cogent enough for the meaning to come through. Spelling and grammatical mistakes do not reduce a score, but spelling must be close enough so that the reader is convinced of the word." Do not penalize poor writing quality — only unclear or incorrect content.

**Rule 2 — Students must clearly indicate which part they are answering.**
"A student can earn points only if the student is clearly addressing the topic of the source material in their response." You can infer which part is being answered if responses follow question order, but ambiguous responses that cannot be matched to a specific part do not score.

**Rule 3 — Application is mandatory; definitions alone earn zero.**
"The response must apply the concept to the prompt. A definition alone will not earn the point, but a clear definition can support the application." A textbook definition without connection to the specific scenario or source material NEVER earns credit. A strong definition paired with clear application strengthens the response.

**Rule 4 — Rubric examples are not exhaustive.**
Acceptable answers extend beyond those listed in the scoring guidelines. If a student provides a valid answer not explicitly in the rubric, award the point if the response demonstrates correct understanding and application.

**Rule 5 — No penalty for incorrect information, UNLESS it directly contradicts.**
"Within a question part, a response will not be penalized for incorrect information unless it directly contradicts correct information that otherwise would have earned the point(s)." Extraneous wrong information alongside a correct application is fine. But stating contradictory positions (e.g., identifying a variable as both IV and DV) eliminates the point.

## ADDITIONAL SCORING RULES

**Anti-shotgunning rule:** A response does not score if it includes a correct answer buried among multiple incorrect answers related to the same general concept or theory. Example: describing conscientiousness as "diligent, trusting, highly emotional, outgoing, and intellectually curious" — only "diligent" is correct but surrounded by other Big Five trait descriptors.

**Correct application overrides incorrect definition:** A correct application paired with an incorrect definition is NOT considered a direct contradiction and still earns the point.

## AP PSYCHOLOGY FRQ STRUCTURES

### Article Analysis Question (AAQ) — FRQ 1
- Part A: Research Method (0–1 pt) — task verb: "identify." Student names the method. Naming multiple methods risks contradiction.
- Part B: Research Variable (0–1 pt) — task verb: "state." Must give the measurable/quantifiable operational definition as used in the study, not a general conceptual definition.
- Part C: Statistic Interpretation (0–1 pt) — task verb: "describe." Must interpret the statistic's meaning in context, not merely restate numbers or define statistical terms. Slight data errors are OK if direction is correct.
- Part D: Ethical Guidelines (0–1 pt) — Must reference an ethical guideline EXPLICITLY described in the study summary. Guidelines not mentioned in the source do not count. Multiple guidelines risk contradiction.
- Part E: Generalizability (0–1 pt) — Must use SPECIFIC participant demographics (age, race, gender), not just sample size.
- Part F: Argumentation (0–2 pts) — Must cite specific evidence AND explain how it connects. 1 pt for evidence or explanation alone; 2 pts requires both integrated.

### Evidence-Based Question (EBQ) — FRQ 2
- Part A: Claim (0–1 pt) — Scored independently. A relevant, defensible claim earns the point regardless of Parts B/C.
- Part B: Evidence and Reasoning (0–3 pts):
  - B(i) Evidence (0–1 pt) — Specific, accurate evidence from a source with citation.
  - B(ii) Explanation & Application (0–2 pts) — 1 pt for explaining evidence-claim link; 2 pts requires also applying a CED-listed psychological concept.
- Part C: Evidence and Reasoning (0–3 pts) — Same structure as B, but MUST use a different source (or different evidence from same source) AND a different psychological concept.
- "No double jeopardy": explanation/application points can be earned even if the evidence point was not earned.
- Certain terms from source material are ineligible for the application point (e.g., "confederate," "statistically significant," "independent variable," "dependent variable," "experiment," "meta-analysis").

## TASK VERB DEFINITIONS

- **Identify**: Simply name or point out.
- **State**: Provide a clear declarative assertion.
- **Describe**: Provide relevant characteristics or features.
- **Explain**: Demonstrate connections, relationships, or cause-and-effect reasoning.

## COMMON STUDENT ERRORS TO WATCH FOR

- Defining without applying (the #1 error)
- Parroting / restating the question's language without adding understanding
- Concept confusion: accommodation vs. assimilation, random assignment vs. random sampling, correlation vs. causation, egotism vs. egocentrism, intrinsic vs. extrinsic motivation
- AAQ Part A: Naming data collection procedures ("survey") instead of the research methodology ("experiment")
- AAQ Part D: Naming ethical guidelines not described in the passage
- AAQ Part E: Referencing sample size instead of participant demographics
- Big Five traits: Using everyday meanings instead of technical psychological definitions

## OUTPUT FORMAT

You MUST respond with valid JSON only — no markdown, no commentary outside the JSON. Use this exact structure:

{
  "parts": [
    {
      "part": "A",
      "points_earned": 0 or 1,
      "points_possible": 1,
      "justification": "See justification requirements below."
    }
  ],
  "total_score": <sum of points earned>,
  "max_score": <sum of points possible>,
  "overall_feedback": "See overall feedback requirements below."
}

For multi-point parts (like AAQ Part F or EBQ Parts B/C), break them into sub-parts:
- "B(i)", "B(ii)", "C(i)", "C(ii)", "F-evidence", "F-explanation"

## JUSTIFICATION REQUIREMENTS — THIS IS CRITICAL

Each justification MUST be thorough and detailed. A teacher reading your justification should be fully convinced of the scoring decision without needing to re-read the student's response. Every justification must include ALL of the following:

1. **RUBRIC CRITERION**: State the specific rubric requirement for this part. What exactly must the student demonstrate to earn the point?

2. **STUDENT'S EXACT WORDS**: Quote the specific passage(s) from the student's response that are relevant to this scoring point. Use direct quotation marks. If the student did not address this part at all, state that explicitly.

3. **ANALYSIS**: Explain in detail WHY the student's response does or does not meet the rubric criterion. Address each of these as applicable:
   - Does the response go beyond a mere definition to apply the concept to the specific prompt/source material? (Rule 3)
   - Is the response accurate, or does it contain errors? If errors exist, are they minor (e.g., slight data value misstatements with correct direction) or substantive?
   - Does the response contradict itself? (Rule 5) If the student provided extra incorrect information, explain why it does or does not constitute a disqualifying contradiction.
   - Does the response demonstrate understanding through application, or is it parroting/restating the question?
   - For task verbs: did the student meet the level of specificity required (identify vs. state vs. describe vs. explain)?

4. **SCORING DECISION**: Conclude with a clear statement: "POINT AWARDED" or "POINT NOT AWARDED" and a one-sentence summary of the decisive reason.

Each justification should be a full, substantive paragraph — typically 5-8 sentences. Do NOT write vague or generic justifications. Every claim in your justification must be grounded in the student's actual text.

## OVERALL FEEDBACK REQUIREMENTS

The overall_feedback field must be a thorough summary paragraph (5-8 sentences) that includes:
- An opening assessment of the response's overall quality and demonstration of understanding
- Specific strengths with examples (quote the student where they excelled)
- Specific weaknesses with concrete guidance on what was missing or incorrect
- If points were lost, explain exactly what the student should have written instead to earn those points
- A closing note on the most important area for improvement, referencing the relevant AP scoring rule or common error pattern by name

Be precise. Be fair. Award every point the student has earned. Do not be more strict than a trained AP reader would be."""


def _build_user_message(rubric: str, reference: str, question: str, response_data: dict) -> list:
    """Build the user message content blocks for Claude."""
    content = []

    ref_section = f"## REFERENCE MATERIAL / SOURCE ARTICLE\n\n{reference}\n\n" if reference else ""

    content.append({
        "type": "text",
        "text": (
            f"## SCORING RUBRIC\n\n{rubric}\n\n"
            f"{ref_section}"
            f"## FRQ QUESTION / PROMPT\n\n{question}\n\n"
            "## STUDENT RESPONSE\n\n"
        ),
    })

    if response_data["type"] == "text":
        content.append({
            "type": "text",
            "text": response_data["content"],
        })
    elif response_data["type"] == "image":
        content.append({
            "type": "text",
            "text": "The student response is a handwritten/scanned image. Read it carefully and grade it:",
        })
        content.append(response_data["content"])

    content.append({
        "type": "text",
        "text": "\nGrade this response now. Return ONLY valid JSON in the specified format.",
    })

    return content


def grade_single_response(
    rubric: str,
    reference: str,
    question: str,
    response_data: dict,
    api_key: Optional[str] = None,
) -> dict:
    """
    Grade a single student response against the rubric.

    Args:
        rubric: The scoring rubric text.
        reference: The source article / reference material students read.
        question: The FRQ question/prompt text.
        response_data: Dict from file_processor.process_file().
        api_key: Anthropic API key (falls back to env var).

    Returns:
        Parsed grading result dict with points, justifications, feedback.
    """
    key = api_key or os.environ.get("CLAUDE")
    if not key:
        raise ValueError("No Anthropic API key provided.")

    client = anthropic.Anthropic(api_key=key)

    user_content = _build_user_message(rubric, reference, question, response_data)

    result_text = ""
    with client.messages.stream(
        model=MODEL,
        max_tokens=32000,
        thinking={
            "type": "adaptive",
        },
        system=AP_PSYCH_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    ) as stream:
        for event in stream:
            pass
        response = stream.get_final_message()

    for block in response.content:
        if block.type == "text":
            result_text = block.text
            break

    result_text = result_text.strip()
    if result_text.startswith("```"):
        lines = result_text.split("\n")
        lines = lines[1:]  # drop opening fence
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        result_text = "\n".join(lines)

    try:
        result = json.loads(result_text)
    except json.JSONDecodeError:
        result = {
            "error": "Failed to parse grading response as JSON.",
            "raw_response": result_text,
            "parts": [],
            "total_score": 0,
            "max_score": 0,
            "overall_feedback": "Grading error — could not parse model output.",
        }

    result["student_file"] = response_data.get("filename", "unknown")
    return result


def grade_all_responses(
    rubric: str,
    reference: str,
    question: str,
    responses: List[dict],
    api_key: Optional[str] = None,
) -> List[dict]:
    """
    Grade multiple student responses sequentially.

    Args:
        rubric: The scoring rubric text.
        reference: The source article / reference material students read.
        question: The FRQ question/prompt text.
        responses: List of dicts from file_processor.process_file().
        api_key: Anthropic API key.

    Returns:
        List of grading result dicts, one per student.
    """
    results = []
    for resp in responses:
        try:
            result = grade_single_response(rubric, reference, question, resp, api_key)
        except Exception as e:
            result = {
                "student_file": resp.get("filename", "unknown"),
                "error": str(e),
                "parts": [],
                "total_score": 0,
                "max_score": 0,
                "overall_feedback": f"Grading failed: {e}",
            }
        results.append(result)
    return results
