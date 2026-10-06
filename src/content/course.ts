export type QuizQ = { q: string; a: string[]; c: number; why: string };
export type LensTerm = { term: string; plain: string; exam: string };
export type Checkpoint =
  | { kind: "text"; prompt: string; placeholder?: string; minLength?: number }
  | { kind: "choice"; prompt: string; options: string[]; correct: number; why: string }
  | { kind: "upload"; prompt: string }
  | { kind: "confirm"; prompt: string };
export type Step = {
  label: string;        // short title shown in the rail
  why?: string;         // one line on why this step matters
  do: string[];         // numbered instructions, written for someone who has never used the tool
  see: string;          // what the screen should show when it worked
  tip?: string;         // what to try if it didn't
  checkpoint?: Checkpoint;
};
export type Session = {
  id: string;            // e.g. "w01d2"
  week: number;
  day: 1 | 2 | 3;
  title: string;
  goal?: string;
  steps?: Step[];
  stretch?: string[];
  doneWhen?: string[];
  lens?: LensTerm[];
  quiz?: QuizQ[];
  sandbox?: "classifier";
  submission?: { prompt: string; kinds: Array<"image" | "link" | "text"> };
  built: boolean;        // false = shell only, content comes later
};
export type Week = { n: number; theme: string; phase: number };
export type Phase = { n: number; name: string; question: string; weeks: number[] };

export const PHASES: Phase[] = [
  { n: 1, name: "How AI Actually Works", question: "What is AI, what's happening inside a model, and how do I control it?", weeks: [1, 2, 3, 4] },
  { n: 2, name: "AI at Work and Programming Literacy", question: "How do I use AI for everyday work and data, and how does software actually think?", weeks: [5, 6, 7] },
  { n: 3, name: "Automation, Knowledge Bots, and Agents", question: "How do I automate real processes, ground AI in business knowledge, build applications and agents that act, and see what they did?", weeks: [8, 9, 10, 11, 12, 13] },
  { n: 4, name: "Reliable, Responsible, Business-Ready, and Certified", question: "How does AI break, how do I prove it keeps working, what does it cost, and am I ready for the exam?", weeks: [14, 15, 16, 17, 18] },
  { n: 5, name: "Capstone and Career", question: "Can I build, test, secure, and hand off a real AI solution for a real stakeholder?", weeks: [19, 20] },
];

export const WEEKS: Week[] = [
  [1, "What AI Is and How Machines Learn"], [2, "Inside Large Language Models"], [3, "The Model Landscape and Generative AI on AWS"], [4, "Prompt Engineering and Context Engineering"],
  [5, "AI Assistants for Everyday Work"], [6, "Data and Spreadsheets with AI"], [7, "How Software Thinks: Programming Fundamentals"],
  [8, "Workflow Automation I: Zapier and Make"], [9, "Workflow Automation II: n8n"], [10, "Knowledge Bots: RAG and Chatbots"], [11, "Building Applications with AI: Vibe Coding and GitHub"], [12, "AI Agents for Operations"], [13, "Visual Agent Builders, Multi-Agent Teams, and Connected Tools"],
  [14, "Breaking AI: How It Fails and How It's Attacked"], [15, "Evaluating, Defending, and Costing AI"], [16, "AI Across Industries"], [17, "Responsible AI, Governance, and AI Strategy"], [18, "AWS Certified AI Practitioner Exam Readiness"],
  [19, "Capstone Build"], [20, "Portfolio, Presentations, and Graduation"],
].map(([n, theme]) => ({ n: n as number, theme: theme as string, phase: PHASES.find(p => p.weeks.includes(n as number))!.n }));

const DAY_TITLES: Record<number, [string, string, string]> = {
  1: ["What Is AI? The Family Tree, the Timeline, and When Not to Use It", "How Machines Learn from Data", "The ML Lifecycle and How We Measure Models"],
  2: ["Neural Networks and Deep Learning, No Math Required", "Tokens, Embeddings, and Transformers", "How LLMs Generate Answers and How They're Trained"],
  3: ["LLMs, SLMs, Open and Closed Models, and Running AI Locally", "Multimodal Generative AI: Images, Audio, and Video", "Generative AI on AWS: Foundation Models, Bedrock, and PartyRock"],
  4: ["Prompt Engineering That Works", "Context Engineering: Projects, Memory, and Grounding", "AI for Research and Writing, and the Risks Hidden in Prompts"],
  5: ["Designing Reusable AI Assistants", "Meetings, Email, and Documents with AI", "Presentations and Visual Communication"],
  6: ["Spreadsheet Foundations with an AI Co-Pilot", "Cleaning and Analyzing Messy Data", "Dashboards and Data Stories"],
  7: ["Thinking Like a Programmer", "JSON, APIs, and Webhooks in Plain Language", "Reading and Editing Code with AI"],
  8: ["Automation Logic and Your First Zap", "AI Steps in Make Scenarios", "Reliable Automations: Errors, Testing, and Documentation"],
  9: ["n8n Basics: Open-Source Automation", "AI Nodes and Structured Output in n8n", "Multi-System Data Pipelines"],
  10: ["Embeddings and RAG Without Code", "Build a Grounded Chatbot", "Conversation Design and Chatbot Testing"],
  11: ["Vibe Coding a Real Application", "GitHub and VS Code: Versioning and Growing Your App", "Publishing Safely"],
  12: ["From Chatbots to Agents", "How Agents Use Tools, and Tracing What They Did", "Agents with Memory, Planning, and Human Approval"],
  13: ["Visual Agent Builders Compared", "Multi-Agent Teams Without Code", "MCP Trust, A2A, and Skills for Power Users"],
  14: ["How AI Fails on Its Own", "Prompt Injection and Jailbreaks", "Attacking Agents, Automations, and Browser Agents"],
  15: ["Continuous Evaluation: Proving It Keeps Working", "Guardrails and Logging in Workflows", "Choosing How to Improve AI, and What It Costs"],
  16: ["Marketing, Content, and Personalization", "Customer Service, Operations, and Finance", "HR, Healthcare, and Legal: High-Stakes AI"],
  17: ["Responsible AI in Practice", "Security, Compliance, and Governance for AI", "Requirements, ROI, and Capstone Proposals"],
  18: ["Exam Review: AI, ML, and Generative AI Fundamentals", "Exam Review: Applications, Responsible AI, and Security", "Practice Exam and Capstone Architecture"],
  19: ["Build the Core on Budget", "Evaluate, Red Team, and Harden", "Package and Hand Off the Capstone"],
  20: ["Portfolio and the AI Job Market", "Capstone Presentations", "Final Presentations, What's Next, and Graduation"],
};

export const sid = (w: number, d: number) => `w${String(w).padStart(2, "0")}d${d}`;

// ----- Week 1, fully built -----
const W1: Partial<Record<string, Omit<Session, "id" | "week" | "day" | "title" | "built">>> = {
  w01d1: {
    goal: "Pick one task from your current job or the job you want. You'll run it through three assistants today.",
    steps: [
      { label: "Write your goal", why: "Every lab starts with your own task so the work matters to you.", do: ["Think of one task you do (or will do) regularly: a weekly report, answering customer emails, planning a schedule.", "Type it in one or two sentences in the box below. Be specific: 'Summarize my team's weekly sales numbers into a short update' beats 'reporting'."], see: "A one or two sentence goal in the box. That's it.", checkpoint: { kind: "text", prompt: "Your task, in one or two sentences", placeholder: "Example: Draft replies to the five most common customer questions at my store.", minLength: 20 } },
      { label: "Create your three accounts", why: "You'll compare the three big assistants side by side all course long.", do: ["Open chatgpt.com and click Sign up. Use your Google account to skip a password.", "Open claude.ai and do the same.", "Open gemini.google.com. It signs in with the same Google account automatically.", "Leave all three tabs open."], see: "Three browser tabs, each with an empty chat box and a blinking cursor.", tip: "If a site asks for a phone number, that's normal for the free tier. If you'd rather not, ask your instructor for the class backup account.", checkpoint: { kind: "confirm", prompt: "All three tabs are open and I can type in each one." } },
      { label: "Write three questions", why: "Writing questions before you ask stops the assistant from steering you.", do: ["Open a new Google Doc and title it 'Week 1 Day 1 comparison'.", "Write three questions about your task that you'd ask an experienced coworker. One factual (what is...), one how-to (how would I...), one judgment (should I...).", "Number them 1, 2, 3."], see: "A doc with your goal at the top and three numbered questions.", checkpoint: { kind: "text", prompt: "Paste your three questions", placeholder: "1. ...\n2. ...\n3. ...", minLength: 40 } },
      { label: "Ask all three assistants", why: "Same question, three answers. The differences are the lesson.", do: ["Copy question 1. Paste it into ChatGPT, press Enter. Paste the same text into Claude and Gemini.", "Under question 1 in your doc, paste each answer with a label: ChatGPT, Claude, Gemini.", "Repeat for questions 2 and 3."], see: "Nine answers in your doc, three under each question. Some will be long; that's fine.", tip: "If an assistant asks you a clarifying question instead of answering, type 'Just give me your best answer' and continue.", checkpoint: { kind: "choice", prompt: "Quick check: the three assistants gave different answers to the same question. Why?", options: ["One of them is broken", "They predict likely text from different training and settings, so there's no single 'correct' output", "They looked up different websites", "The question was too short"], correct: 1, why: "Each assistant predicts the next words from its own training and settings. Different models, different predictions. None of them looked anything up unless you saw a 'searching' indicator." } },
      { label: "Mark what's wrong or vague", why: "Spotting the weak spots is the skill. Trusting output blindly is the trap.", do: ["Read each answer. Highlight in yellow anything that's wrong, made up, or so vague it doesn't help.", "If an answer looks perfect, reply to the assistant: 'What's your source for that?' and highlight anything it can't back up.", "Aim for at least one highlight per assistant."], see: "Yellow highlights across your doc. At least three total.", checkpoint: { kind: "text", prompt: "Describe the worst mistake you found and which assistant made it", placeholder: "Example: Gemini said my state's sales tax is 4% but it's 8%.", minLength: 20 } },
      { label: "Sort eight real applications", why: "This is Domain 1 of the exam: knowing which kind of problem is which.", do: ["Decide whether each is Regression (predicts a number), Classification (picks a category), or Clustering (finds groups without labels):", "Fraud detection · Sales forecasting · Movie recommendations · Spam filter · House price prediction · Grouping customers by behavior · Photo tagging · Demand planning", "Write your eight answers, one per line, with a short reason."], see: "Eight lines. Typical answers: fraud = classification, forecasting = regression, recommendations = clustering or classification, spam = classification, house price = regression, customer groups = clustering, photo tagging = classification, demand = regression.", checkpoint: { kind: "choice", prompt: "Grouping customers by shopping behavior, with no labels given, is:", options: ["Regression", "Classification", "Clustering", "Reinforcement learning"], correct: 2, why: "No labels and the goal is to find natural groups: that's clustering. Classification needs labeled categories to learn from." } },
      { label: "Upload your doc", do: ["Take a screenshot of your comparison doc showing at least one highlighted answer, or set the doc to 'Anyone with the link can view' and copy the link.", "Upload it below."], see: "A thumbnail of your screenshot, or your link, in the submissions list.", checkpoint: { kind: "upload", prompt: "Screenshot or link to your comparison doc" } },
    ],
    stretch: ["Ask each assistant to describe its own limits, then fact-check one claim it made about itself using an official source", "Rewrite your weakest question so all three assistants give a useful answer"],
    doneWhen: ["Three assistants, nine answers, at least three highlights", "All eight applications sorted with one reason each", "Doc screenshot or link submitted"],
    submission: { prompt: "Upload a screenshot of your comparison doc, or paste a link to it.", kinds: ["image", "link"] },
    lens: [
      { term: "Agentic AI", plain: "A model plus tools plus a loop that decides its next step.", exam: "Domain 1: agentic AI as the newest layer of AI." },
      { term: "Generative AI", plain: "AI that creates new content instead of only predicting a label.", exam: "Domain 1: generative AI built on deep learning." },
      { term: "When not to use AI", plain: "You need an exact repeatable answer, there's not enough good data, or the cost outweighs the value.", exam: "Domain 1: when AI/ML is and isn't appropriate." },
      { term: "Classification vs regression", plain: "Sorting into categories vs predicting a number.", exam: "Domain 1: real-world use cases by problem type." },
    ],
    quiz: [
      { q: "Which statement about the AI family tree is correct?", a: ["Machine learning is a type of generative AI", "Deep learning sits inside machine learning, which sits inside AI", "Generative AI replaced machine learning in 2022", "AI and machine learning are the same thing"], c: 1, why: "AI is the umbrella. Machine learning is inside it, deep learning inside that, and generative AI is built on deep learning." },
      { q: "A pharmacy needs the exact same tax calculation every time. Why is AI the wrong tool?", a: ["AI is too expensive for pharmacies", "AI gives plausible answers, not guaranteed exact ones", "Tax rules change too often", "AI can't do math at all"], c: 1, why: "When you need an exact, repeatable answer every time, a rule or formula beats a model that predicts." },
      { q: "Predicting next month's sales figure is an example of:", a: ["Classification", "Clustering", "Regression", "Reinforcement learning"], c: 2, why: "Regression predicts a number. Classification sorts into categories. Clustering finds groups." },
      { q: "What makes an AI system an agent rather than a chatbot?", a: ["It uses a bigger model", "It can take actions with tools and decide its next step", "It answers faster", "It runs on AWS"], c: 1, why: "An agent is a model plus tools plus a loop that decides what to do next." },
      { q: "Which was the 2017 breakthrough that today's language models build on?", a: ["The first chatbot", "The transformer paper", "The launch of ChatGPT", "The 2012 image contest"], c: 1, why: "The 2017 transformer paper introduced attention, the mechanism inside every modern LLM." },
    ],
  },
  w01d2: {
    sandbox: "classifier",
    goal: "Decide what two things your classifier will tell apart. Pick something you can photograph right now (two kinds of objects on your desk work well).",
    steps: [
      { label: "Try the sandbox first", why: "See the idea before you touch the tool: a classifier is just a line that separates two groups.", do: ["Open the Sandbox tab above.", "Drag the line until it separates blue dots from orange dots. Watch Training accuracy climb.", "Click 'Skewed sample'. Notice how many different lines separate it perfectly.", "Click 'New data (test)'. Watch what happens to a line that looked perfect on skewed data.", "Click 'Record my result'."], see: "Training accuracy above 90% on the fair sample, and a visible drop when a skewed fit meets new data.", checkpoint: { kind: "choice", prompt: "A line fit on the skewed sample scored 100% in training and much lower on new data. What's the lesson?", options: ["The test data was wrong", "A model can look perfect on data that never showed it the hard cases", "You need more lines", "Accuracy doesn't matter"], correct: 1, why: "The skewed sample hid the hard cases near the boundary, so any line looked perfect. Real data exposed the gap. That's overfitting to a bad sample." } },
      { label: "Label photos with a partner", why: "Labels are human decisions. You're about to find out how fuzzy they are.", do: ["Pair up. Your instructor will share a folder of 20 photos.", "Without talking, each of you writes a label for every photo (for example 'formal' or 'casual').", "Compare lists. Count how many you disagreed on."], see: "Two lists of 20 labels and a disagreement count.", checkpoint: { kind: "text", prompt: "How many of 20 did you disagree on, and give one example", placeholder: "Example: 4. We disagreed on photo 7; I said casual, she said formal because of the shoes.", minLength: 15 } },
      { label: "Open Teachable Machine", why: "This is a real training tool, used the way you'll see in the lab.", do: ["Go to teachablemachine.withgoogle.com and click Get Started.", "Choose Image Project, then Standard image model.", "Rename Class 1 and Class 2 to your two objects (for example 'Mug' and 'Phone')."], see: "Two class boxes with your names on them, each with a Webcam button, and a Train Model button in the middle.", tip: "If the webcam button is grey, your browser blocked the camera. Click the lock icon in the address bar and allow Camera." , checkpoint: { kind: "confirm", prompt: "I see two named class boxes and a Train Model button." } },
      { label: "Collect varied photos", why: "Variety in the training data is what makes a model work on new data.", do: ["Click Webcam under your first class. Hold the object up and press and hold 'Hold to Record' while slowly turning it. Aim for 20 to 30 samples.", "Move to a different spot in the room, change the angle, change the background, and record more.", "Repeat for the second class."], see: "A strip of thumbnails under each class, and the thumbnails don't all look alike.", checkpoint: { kind: "choice", prompt: "Why move around the room while recording?", options: ["The camera needs to warm up", "So the model learns the object, not the background or lighting", "To get more total photos", "It doesn't matter"], correct: 1, why: "If every photo of one class has the same background, the model can learn the background as the shortcut. Variety forces it to learn the object." } },
      { label: "Train and test", do: ["Click Train Model. Wait for it to finish (under a minute).", "In the Preview panel, hold up each object. Watch the confidence bars.", "Now hold up something that isn't either object. Watch what it does."], see: "Confidence bars that swing toward the right class for your objects. For the unknown object, it still picks one; it has no 'neither' option.", checkpoint: { kind: "text", prompt: "What did the model say when you showed it an object that was neither class?", placeholder: "Example: It said 85% Mug for my water bottle.", minLength: 10 } },
      { label: "Break it on purpose with skewed data", why: "Seeing a model fail is the fastest way to understand what it learned.", do: ["Click the three dots on your first class and choose Delete all samples.", "Re-record it in ONE spot only: same background, same lighting, same angle.", "Train again. Then test that object from a different spot in the room."], see: "Confidence collapses or flips when you move. The model learned the spot, not the object.", checkpoint: { kind: "text", prompt: "Write one sentence explaining the failure. Name the shortcut the model learned.", placeholder: "Example: It learned 'brown desk' means mug because every mug photo had the desk behind it.", minLength: 20 } },
      { label: "Add a third class and five edge cases", do: ["Click Add a class. Name it and record varied samples.", "Train. Then test five edge cases: odd angle, partly hidden, far away, a lookalike object, a drawing of the object.", "Note which ones fool it."], see: "At least one edge case gets the wrong answer.", checkpoint: { kind: "text", prompt: "Which edge cases fooled it?", placeholder: "Example: Far away and the drawing both got labeled as the phone.", minLength: 10 } },
      { label: "Fill in your data sheet", why: "Real teams document what a model saw and didn't see. You're doing the same.", do: ["Answer four things: What data did your model see? What did it never see? Three inputs that would fool it. What data would fix each?", "Keep it to a few lines each."], see: "Four short answers.", checkpoint: { kind: "text", prompt: "Your data sheet", placeholder: "Saw: ...\nNever saw: ...\nWould fool it: ...\nFix: ...", minLength: 60 } },
      { label: "Upload a screenshot", do: ["Take a screenshot of Teachable Machine showing your three classes and the Preview panel with a prediction.", "Upload it below."], see: "A thumbnail in the submissions list.", checkpoint: { kind: "upload", prompt: "Screenshot of your trained model" } },
    ],
    stretch: ["Collect a balanced retraining set and prove the five edge cases pass", "Sort four scenarios into real-time, serverless, asynchronous, or batch inference"],
    doneWhen: ["A trained model with three classes", "A written failure sentence and a completed data sheet", "Screenshot submitted"],
    submission: { prompt: "Upload a screenshot of your trained model's preview.", kinds: ["image", "text"] },
    lens: [
      { term: "Supervised learning", plain: "Learning from examples that come with the right answer attached.", exam: "Domain 1: supervised vs unsupervised vs reinforcement learning." },
      { term: "Training vs inference", plain: "Training is learning from data. Inference is using what was learned on new data.", exam: "Domain 1: training and inference; real-time, serverless, asynchronous, and batch inference on AWS." },
      { term: "Overfitting", plain: "Memorizing the training examples instead of learning the pattern, so new data fails.", exam: "Domain 1: overfitting and underfitting." },
      { term: "Labeled data", plain: "Data where a human has already marked the correct answer.", exam: "Domain 1: labeled vs unlabeled, structured vs unstructured data." },
    ],
    quiz: [
      { q: "Your classifier learned that 'mug' means 'brown background' because every mug photo had one. This is an example of:", a: ["Underfitting", "A shortcut learned from skewed training data", "Reinforcement learning", "Too much data"], c: 1, why: "The model found the easiest pattern that separated the classes. That pattern was the background, not the object." },
      { q: "Which type of learning uses examples that already have the correct answer attached?", a: ["Unsupervised", "Reinforcement", "Supervised", "Generative"], c: 2, why: "Supervised learning trains on labeled examples. Unsupervised finds groups without labels." },
      { q: "A model scores 99% on its training photos and 60% on new photos. What's the most likely problem?", a: ["The new photos are broken", "Overfitting", "The model needs a bigger GPU", "Underfitting"], c: 1, why: "A big gap between training and new data is the signature of overfitting." },
      { q: "Two people label the same photos and disagree on 4 of 20. What does this tell you?", a: ["One person is wrong", "Labels are human decisions, and the model learns whatever decisions it's given", "The photos are low quality", "You need fewer labels"], c: 1, why: "Labels encode judgment. If the labelers disagree, the model inherits that fuzziness." },
      { q: "A bank wants fraud scores the instant a card is swiped. Which inference style fits?", a: ["Batch", "Asynchronous", "Real-time", "Weekly"], c: 2, why: "Real-time inference returns an answer immediately. Batch runs on a schedule over many records." },
    ],
  },
  w01d3: {
    goal: "Decide what mistake would cost more for your classifier: a false alarm or a missed case. Write that down before you compute anything.",
    steps: [
      { label: "Decide which mistake costs more", why: "Metrics only make sense once you know which error hurts.", do: ["Think about your Day 2 classifier as if a business depended on it.", "A false alarm: it says 'yes' when the truth is 'no'. A missed case: it says 'no' when the truth is 'yes'.", "Decide which would cost more in your scenario and why."], see: "One sentence naming the costlier mistake.", checkpoint: { kind: "text", prompt: "Which mistake costs more for your classifier, and why?", placeholder: "Example: A missed case. If this were a defect detector, shipping a bad part costs more than re-checking a good one.", minLength: 20 } },
      { label: "Test on 20 new images", do: ["Open your Teachable Machine project from Day 2 (it's saved in your browser; if not, retrain quickly with two classes).", "Pick one class to be your 'positive'. Show the model 20 objects, 10 positive and 10 not.", "For each, write down what the model said and what was true."], see: "A list of 20 rows: predicted and actual.", checkpoint: { kind: "confirm", prompt: "I have 20 predicted-versus-actual results written down." } },
      { label: "Build the confusion matrix in Sheets", why: "The confusion matrix is how every ML team reads a model's mistakes. It's on the exam.", do: ["Open a new Google Sheet. In A1 type 'Predicted Yes', A2 'Predicted No'. In B0 and C0 (row 1, columns B and C) type 'Actual Yes' and 'Actual No'.", "Count your 20 results into the four cells: True Positive (predicted yes, actual yes), False Positive (predicted yes, actual no), False Negative (predicted no, actual yes), True Negative (predicted no, actual no).", "Check the four cells add to 20."], see: "A 2 by 2 grid of counts that sums to 20.", tip: "Mixed up which is which? False Positive is the false alarm. False Negative is the missed case.", checkpoint: { kind: "choice", prompt: "The model said 'Mug' but it was a phone. Which cell?", options: ["True Positive", "False Positive", "False Negative", "True Negative"], correct: 1, why: "Predicted yes (mug) when the truth was no: a false positive, the false alarm." } },
      { label: "Write the three formulas", why: "Formulas update when counts change. Typed numbers don't. That rule carries through the whole course.", do: ["Accuracy: =(TP+TN)/20. Click the TP cell, type +, click TN, close the bracket, divide by 20.", "Precision: =TP/(TP+FP). Of everything it flagged, how many were right.", "Recall: =TP/(TP+FN). Of all the real positives, how many it caught.", "Change one count and watch all three update. Then change it back."], see: "Three cells showing decimals between 0 and 1. Changing a count changes them instantly.", checkpoint: { kind: "text", prompt: "Your accuracy, precision, and recall", placeholder: "Example: Accuracy 0.85, Precision 0.90, Recall 0.80", minLength: 10 } },
      { label: "Make three build-versus-buy calls", why: "The exam asks this constantly: ready-made AWS service, or train your own?", do: ["For each problem, decide 'managed service' or 'custom model' and give one reason:", "A) Pull text out of 5,000 scanned invoices. B) Predict which of your 300 regular customers will stop ordering next quarter, using your own sales history. C) Transcribe recorded customer calls to text.", "Hint: a managed service fits common tasks (text from images, speech to text). A custom model fits problems only your data can answer."], see: "Three decisions with reasons.", checkpoint: { kind: "choice", prompt: "Problem B (predict which of your customers will leave, from your own history) is best handled by:", options: ["Amazon Textract", "Amazon Transcribe", "A custom model trained on your data", "A spreadsheet formula"], correct: 2, why: "No ready-made service knows your customers. This needs a model trained on your own history, for example in SageMaker. A and C are classic managed-service tasks: Textract for documents, Transcribe for speech." } },
      { label: "Share your sheet", do: ["Click Share in the top right of your Sheet. Change General access to 'Anyone with the link' as Viewer. Copy link.", "Paste it below."], see: "Your link in the submissions list.", checkpoint: { kind: "upload", prompt: "Link to your confusion matrix sheet" } },
    ],
    stretch: ["Pick a fraud or medical screening scenario and argue which metric matters most", "Explain why high accuracy could still hide a dangerous model"],
    doneWhen: ["A confusion matrix with working formulas", "Three build-versus-buy decisions with reasons", "Sheet link submitted"],
    submission: { prompt: "Paste the link to your Google Sheet (set to anyone with the link can view).", kinds: ["link", "image"] },
    lens: [
      { term: "Confusion matrix", plain: "A 2 by 2 table of right and wrong answers, split by what the model said and what was true.", exam: "Domain 1: model evaluation metrics." },
      { term: "Precision vs recall", plain: "Precision: of the ones it flagged, how many were right. Recall: of the real cases, how many did it catch.", exam: "Domain 1: precision, recall, F1, AUC." },
      { term: "ML lifecycle", plain: "Business goal, data, prepare, train, evaluate, deploy, monitor, repeat.", exam: "Domain 1: ML pipeline stages and MLOps." },
      { term: "Managed AI service", plain: "A ready-made model you call, like Rekognition for images or Textract for documents.", exam: "Domain 1: AWS managed AI services vs custom models in SageMaker." },
    ],
    quiz: [
      { q: "A cancer screening model misses 30% of real cases but never raises a false alarm. Which metric is low?", a: ["Precision", "Recall", "Accuracy", "Latency"], c: 1, why: "Recall measures how many real cases were caught. Missing 30% means recall is 70%." },
      { q: "Only 1 in 1,000 transactions is fraud. A model that says 'not fraud' every time scores 99.9% accuracy. Why is that dangerous?", a: ["Accuracy is always wrong", "It catches zero fraud; accuracy hides it because fraud is rare", "The model is overfitting", "Fraud models shouldn't use accuracy"], c: 1, why: "When one class is rare, accuracy can look great while the model is useless. Recall on the rare class is what matters." },
      { q: "Which comes first in the ML lifecycle?", a: ["Training the model", "Defining the business goal", "Deploying to production", "Choosing a GPU"], c: 1, why: "Every stage after depends on knowing what problem you're solving and how you'll measure success." },
      { q: "A company wants to pull text out of scanned invoices and has no ML team. Best choice?", a: ["Train a custom model in SageMaker", "Use a managed service like Amazon Textract", "Hire data scientists first", "Use a spreadsheet"], c: 1, why: "A managed service handles a common task out of the box. Custom models are for problems no ready-made service covers." },
      { q: "After a model is deployed, why does it still need monitoring?", a: ["To bill customers", "Because the real-world data can drift away from what it trained on", "To make it faster", "It doesn't; deployment is the last step"], c: 1, why: "Data drift means the world changes while the model stays the same. Monitoring catches the drop in quality." },
    ],
  },
};

export const SESSIONS: Session[] = WEEKS.flatMap(w =>
  ([1, 2, 3] as const).map(d => {
    const id = sid(w.n, d);
    const extra = W1[id];
    return { id, week: w.n, day: d, title: DAY_TITLES[w.n][d - 1], built: !!extra, ...(extra || {}) } as Session;
  })
);
export const byId = (id: string) => SESSIONS.find(s => s.id === id);
