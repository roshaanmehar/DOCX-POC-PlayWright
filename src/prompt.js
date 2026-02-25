'use strict';

/**
 * Default analysis prompt for Claude.ai chat.
 * Instructs Claude to analyse the attached .docx CV template, identify
 * candidate-varying data, map to standard placeholders, and (in chat)
 * produce the modified .docx with placeholders inserted.
 *
 * Do not use individual instances for repeating sections (e.g. education);
 * use a loop for all repetitions.
 */
export default `You are analysing a Microsoft Word document that an agency uses as a template for candidate CVs.
The document contains sample/fake candidate data. Your job is to identify every piece of data that varies per candidate and map it to the standard placeholder names listed below.

Scalar fields (single values):
  candidate_name    – full name of the candidate
  job_title         – current or desired job title
  email             – email address
  phone             – phone number
  location          – city / country
  linkedin          – LinkedIn profile URL
  website           – personal website URL
  summary           – brief professional summary / profile statement
  right_to_work     – right to work status
  security_clearance – security clearance level
  availability      – notice period or availability date
  nationality       – nationality
  interests         – hobbies, interests, or personal interests paragraph
  references        – references section text (e.g. "Available upon request" or referee details)

Loop / repeating blocks (PascalCase, used in {#Name}...{/Name} tags):
  Experience        – work history entries
    fields inside:  Position, Company, Date Range, Location, Description, Responsibilities (array of bullet strings)
  Education         – education entries
    fields inside:  Qualification, Institution, Date Range, Grade
  Skills            – flat list of skills
    fields inside:  Skill
  Certifications    – certification entries
    fields inside:  Name, Issuer, Date
  Professional_Memberships – membership entries
    fields inside:  Organisation, Role, Date
  Courses_Training  – course entries
    fields inside:  Course, Provider, Date
  CoreCompetencies  – competency list
    fields inside:  Competency
  Technical_Skills  – technical skill groups
    fields inside:  Category, Items (list)
  Project_List      – project entries
    fields inside:  Name, Description, Technologies, Date
  DynamicSections   – catch-all for any other repeating section
    fields inside:  Title, Content

Do not use individual instances for repeating sections. Wherever there is repetition (e.g. education with several entries), use a loop—do not list each instance separately.

Analyse the attached document and produce a modified .docx with:
- Sample/fake data replaced by the standard placeholders above (e.g. {candidate_name}, {email}).
- Repeating sections wrapped in loop tags (e.g. {#Experience}...{/Experience}).
Return the edited document as a downloadable file.`;
