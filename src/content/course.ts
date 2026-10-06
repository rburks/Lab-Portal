export type QuizQ = { q: string; a: string[]; c: number; why: string };
export type LensTerm = { term: string; plain: string; exam: string };
export type Step = { label: string; see: string };
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
      { label: "Create free accounts on ChatGPT, Claude, and Gemini", see: "You can open each one and see an empty chat box." },
      { label: "Write three questions about your task and save them in a doc", see: "Three plain questions, written before you ask any assistant." },
      { label: "Ask all three assistants the same three questions", see: "Nine answers total. Copy each into your doc under the question." },
      { label: "Mark anything wrong, vague, or made up", see: "At least one highlight per assistant. If nothing looks wrong, ask it for a source." },
      { label: "Match the eight applications to regression, classification, or clustering", see: "Fraud detection, forecasting, recommendations, spam filter, price prediction, customer groups, photo tagging, demand planning." },
    ],
    stretch: ["Ask each assistant to describe its own limits", "Fact-check one claim it made about itself using an official source"],
    doneWhen: ["Three assistants, nine answers, at least three highlights", "All eight applications sorted with one reason each"],
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
      { label: "Pair up and label the same 20 photos without talking, then compare", see: "Count your disagreements. Write the number down; it comes back in discussion." },
      { label: "Open Teachable Machine and create an Image Project", see: "Two empty class boxes and a Train button." },
      { label: "Collect 20 to 30 photos per class with your webcam, varying angle and background", see: "Each class shows a strip of thumbnails that don't all look the same." },
      { label: "Train, then test with new objects. Note what it gets right and wrong", see: "The preview shows a confidence bar per class as you move objects in front of the camera." },
      { label: "Retrain with skewed data: one class only in one lighting or background", see: "Now test it in a different spot. Watch confidence collapse." },
      { label: "Write one sentence explaining the failure", see: "It names the shortcut the model learned instead of the object." },
      { label: "Add a third class and test five edge cases", see: "At least one edge case fools it. Record which." },
      { label: "Complete your model's data sheet", see: "What it saw, what it never saw, three inputs that would fool it, what data would fix each." },
    ],
    stretch: ["Collect a balanced retraining set and prove the five edge cases pass", "Sort four scenarios into real-time, serverless, asynchronous, or batch inference"],
    doneWhen: ["A trained model with three classes", "A written failure sentence and a completed data sheet"],
    submission: { prompt: "Upload a screenshot of your trained model's preview and paste your one-sentence failure explanation.", kinds: ["image", "text"] },
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
      { label: "Test your Teachable Machine model on 20 new images", see: "A tally of right and wrong per class." },
      { label: "Record results in Google Sheets as a confusion matrix", see: "A 2 by 2 grid: true positive, false positive, false negative, true negative." },
      { label: "Write formulas for accuracy, precision, and recall", see: "Three cells with formulas, not typed numbers. Change one tally and watch them update." },
      { label: "Make three build-versus-buy calls", see: "Three business problems, each with 'ready-made AWS service' or 'custom model' and one reason." },
    ],
    stretch: ["Pick a fraud or medical screening scenario and argue which metric matters most", "Explain why high accuracy could still hide a dangerous model"],
    doneWhen: ["A confusion matrix with working formulas", "Three build-versus-buy decisions with reasons"],
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
