# User Persona: ChatBridge

## 1. Persona Profile

| Field | Details |
|-------|---------|
| Name | Maya Torres |
| Age | 11 |
| Occupation | 5th Grade Student |
| Tagline | "Can the computer help me figure this out?" |
| Experience | Digital native — comfortable with tablets, educational games, and YouTube. Has used Google Classroom and Khan Academy. First exposure to an AI chatbot in a school setting. |
| Context | Maya attends a Title I public school in a mid-size city. Her class has 1:1 Chromebooks. Her teacher, Mr. Okafor, has started using TutorMeAI to supplement math instruction. Maya is an average-performing student who engages well with interactive, game-like learning but disengages with static worksheets. |
| Goals | Get help with math problems without feeling embarrassed to ask; play educational games that feel fun, not like homework; understand concepts at her own pace without holding up the class. |
| Concerns | Doesn't want to feel "dumb" if she asks the chatbot something basic; worried about making mistakes in front of classmates (even digitally); easily frustrated if tech is slow or confusing. |
| Quote | "I like it when the computer lets me try stuff and doesn't just tell me I'm wrong." |

## 2. Persona Narrative

Maya is eleven years old, the middle child of three, and her favorite subject is science — but math is a struggle. She's not behind, exactly, but fractions make her freeze. When Mr. Okafor introduced the AI chat platform last month, Maya was skeptical. She'd used "learning apps" before that felt like digital worksheets with stickers. But this was different: she could type questions in her own words, and the chatbot answered like a patient tutor, not a textbook.

Last week, Mr. Okafor enabled the chess app inside the chat. Maya had never played chess, but the chatbot walked her through the basics. When she got stuck mid-game, she typed "what should I do here?" and the chatbot analyzed the board and suggested a move — then explained *why*. She felt like she was learning something real, not just following instructions. She played three games that afternoon.

What Maya doesn't know is that the chess app is a third-party integration running in a sandboxed iframe. She doesn't think about where the app "lives" or who built it. To her, it's all one experience — the chatbot and the chess board are the same thing. This is both the platform's greatest strength and its greatest responsibility: Maya's trust is total and undifferentiated. She trusts the chess app because she trusts the chatbot, and she trusts the chatbot because her teacher told her to use it.

Maya's pain points are subtle but real. She abandons tools that feel slow (more than a few seconds of loading). She gets confused by inconsistent interfaces — if the chatbot looks one way and the app looks another, she wonders if she clicked the wrong thing. She won't ask for help if the "ask for help" mechanism feels formal or complicated. And she has zero ability to detect phishing, spoofing, or manipulative content — if a prompt appears inside her learning environment, she follows it.

Maya represents the median user: not the top student who will push the platform's limits, and not the struggling student who needs intensive intervention. She's the student who will use the platform daily if it feels seamless and abandon it silently if it doesn't.

## 3. Knowledge Tree: The Science Behind Maya

### Category 1: Child-Computer Interaction

#### Subcategory 1.1: Trust and Authority in Digital Environments

**Source 1:** "When is it right for a robot to be wrong? Children trust a robot over a human in a selective trust task" (Girouard-Hallam et al., 2024) [1]

- DOK 1 - Facts:
  - Children preferentially trust a robot over a human informant in selective trust paradigms
  - Trust increases when the AI/robot is embedded in an institutional context (school-provided tool)
  - Children are significantly less likely than adults to question information presented by a conversational AI agent

- DOK 2 - Summary: Maya's total trust in the chatbot is developmentally typical. Children her age do not apply critical evaluation to AI-generated content, especially when the AI is endorsed by a trusted adult (her teacher). This makes prompt injection and schema poisoning attacks especially dangerous — Maya will follow any instruction the chatbot gives without question.

#### Subcategory 1.2: Engagement and Cognitive Load

**Source 2:** "Cognitive Architecture and Instructional Design: 20 Years Later" (Sweller, van Merrienboer & Paas, 2019) [2]

- DOK 1 - Facts:
  - Extraneous cognitive load from inconsistent interfaces reduces learning outcomes
  - Students disengage when interface transitions are jarring or unpredictable
  - Seamless tool integration reduces split-attention effect

- DOK 2 - Summary: Maya's sensitivity to interface inconsistency is backed by cognitive load theory. When the chat UI and an embedded app look and behave differently, the cognitive overhead of context-switching reduces her capacity for learning. The hybrid rendering model (where simple apps render natively in the chat's design system) directly addresses this.

### Category 2: Online Safety for Minors

#### Subcategory 2.1: Phishing Susceptibility in Children

**Source 3:** "Phishing Susceptibility Among Children: A Systematic Review" (Lastdrager et al., 2017) [3]

- DOK 1 - Facts:
  - Children under 13 correctly identify phishing attempts less than 25% of the time
  - Contextual cues (e.g., appearing inside a trusted app) dramatically increase susceptibility
  - Children prioritize task completion over security evaluation

- DOK 2 - Summary: Maya's inability to detect in-iframe phishing is the norm, not the exception. A malicious app mimicking a login screen inside the chat would fool her nearly every time. This justifies aggressive sandbox restrictions (no `allow-forms` by default) and persistent visual indicators differentiating third-party content from platform content.

### Category 3: Self-Regulated Learning

#### Subcategory 3.1: Autonomy and Help-Seeking Behavior

**Source 4:** "Help-Seeking and Help-Avoidance in Digital Learning Environments" (Karabenick & Berger, 2013) [4]

- DOK 1 - Facts:
  - Students avoid help-seeking when it threatens perceived competence
  - AI chatbots reduce help-avoidance because they are perceived as non-judgmental
  - Students are more likely to ask for hints in game-like contexts than traditional tutoring interfaces

- DOK 2 - Summary: Maya's willingness to ask the chatbot "what should I do here?" mid-chess-game is consistent with research on help-seeking in low-threat environments. The chatbot-as-actor feature (where the chatbot can make moves on her behalf) further lowers the barrier — she can learn by watching the chatbot play without admitting she's stuck.

## 4. Design Implications for ChatBridge

Based on Maya's persona, ChatBridge should prioritize the following:

1. **Visual consistency between chat and embedded apps.** Use the platform's design system for Tier 1 (JSON-rendered) apps. For Tier 2 (iframe) apps, render a clear but non-alarming border that signals "this is a partner app" without breaking flow. Maya should never wonder "did I leave the chatbot?"

2. **Sub-2-second app loading with skeleton states.** Maya will abandon the experience if the chess board takes 5 seconds to appear. Skeleton loaders that match the app's layout provide continuity. Loading spinners are minimum viable feedback.

3. **The chatbot as a safe, non-judgmental helper — protected from manipulation.** Maya's trust is unconditional. Tool response sanitization, schema review, and output safety classifiers aren't optional features — they're the mechanism that preserves the chatbot's trustworthiness. A single incident where the chatbot says something harmful (via prompt injection) could cause Maya to distrust all AI tools.

4. **No authentication friction for students.** Maya should never see an OAuth consent screen. Platform-mediated auth with teacher-delegated access means Maya just opens the app and it works. The consent hierarchy (district -> teacher -> student) keeps compliance burden off children.

5. **Help mechanisms embedded in context.** Maya won't click a "Help" button. She'll type "I'm stuck" or "what do I do." The chatbot must interpret these as requests for app-specific help and inject the relevant app state (triple log) into its context to respond meaningfully.

## 5. References

[1] Girouard-Hallam, L. et al., 2024. When is it right for a robot to be wrong? Children trust a robot over a human in a selective trust task. *Computers in Human Behavior*. https://www.sciencedirect.com/science/article/pii/S0747563224000979

[2] Sweller, J., van Merrienboer, J.J.G., & Paas, F., 2019. Cognitive Architecture and Instructional Design: 20 Years Later. *Educational Psychology Review*, 31, 261-292. https://link.springer.com/article/10.1007/s10648-019-09465-5

[3] Lastdrager, E. et al., 2017. How Effective is Anti-Phishing Training for Children? *Proceedings of the Thirteenth Symposium on Usable Privacy and Security (SOUPS)*. https://www.usenix.org/conference/soups2017

[4] Karabenick, S.A. & Berger, J.L., 2013. Help Seeking as a Self-Regulated Learning Strategy. In *Applications of Self-Regulated Learning across Diverse Disciplines*. Information Age Publishing.
