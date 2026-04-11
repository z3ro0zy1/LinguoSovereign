export type Locale = "zh" | "en";

export const LOCALE_STORAGE_KEY = "linguo_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: "中文",
  en: "EN",
};

export const CATEGORY_LABELS: Record<Locale, Record<string, string>> = {
  zh: {
    "Reading/Listening": "阅读 / 听力",
    Reading: "阅读",
    Listening: "听力",
    Writing: "写作",
    Speaking: "口语",
  },
  en: {
    "Reading/Listening": "Reading / Listening",
    Reading: "Reading",
    Listening: "Listening",
    Writing: "Writing",
    Speaking: "Speaking",
  },
};

export const I18N = {
  appName: { zh: "LinguoSovereign", en: "LinguoSovereign" },
  home: { zh: "首页", en: "Home" },
  back: { zh: "返回", en: "Back" },
  backToHome: { zh: "返回首页", en: "Back to Home" },
  backToDashboard: { zh: "返回控制台", en: "Back to Dashboard" },
  category: { zh: "分类", en: "Category" },
  nextModule: { zh: "继续进入下一模块", en: "Continue to Next Module" },
  remaining: { zh: "待考", en: "remaining" },
  finishAndViewReport: {
    zh: "结束模考查看总报告",
    en: "Finish Test and View Report",
  },
  noQuestionsAvailable: { zh: "暂无题目", en: "No Questions Available" },
  restoreProgressTitle: {
    zh: "检测到上次未完成的主观题进度",
    en: "Unfinished subjective progress found",
  },
  restoreProgressDesc: {
    zh: "你可以继续上次作答，也可以清空缓存重新开始。",
    en: "You can resume your previous attempt or clear local progress and restart.",
  },
  resume: { zh: "继续作答", en: "Resume" },
  restart: { zh: "重新开始", en: "Restart" },
  submitWithBlanksConfirm: {
    zh: "您还有未作答的题目，确定要全部提交吗？",
    en: "Some questions are still unanswered. Submit anyway?",
  },
  requestFailed: { zh: "请求失败", en: "Request failed" },
  promptSurface: { zh: "题面区", en: "Prompt Surface" },
  responseStudio: { zh: "答题区", en: "Response Studio" },
  writingPrompt: { zh: "写作题面", en: "Writing Prompt" },
  writingResponse: { zh: "撰写你的答卷", en: "Write Your Response" },
  words: { zh: "字数", en: "Words" },
  normalSubmit: { zh: "普通提交", en: "Save Only" },
  aiEvaluate: { zh: "AI 判分并给建议", en: "AI Score and Feedback" },
  submitting: { zh: "提交中...", en: "Submitting..." },
  aiFeedback: { zh: "AI 反馈", en: "AI Feedback" },
  overallBand: { zh: "总分", en: "Overall Band" },
  profilePreview: { zh: "资料预览", en: "Profile Preview" },
  unnamedUser: { zh: "未命名用户", en: "Unnamed user" },
  noEmail: { zh: "无邮箱", en: "No email" },
  profileUploadTip1: {
    zh: "支持本地头像上传，保存后会即时刷新导航栏显示。",
    en: "Local avatar upload is supported. Save to refresh the navbar immediately.",
  },
  profileUploadTip2: {
    zh: "建议使用 1:1 比例图片，文件大小控制在 5MB 以内。",
    en: "A 1:1 image is recommended. Keep the file size under 5MB.",
  },
  nickname: { zh: "昵称", en: "Display Name" },
  enterDisplayName: { zh: "输入展示名称", en: "Enter display name" },
  emailAddress: { zh: "邮箱地址", en: "Email Address" },
  emailImmutable: {
    zh: "邮箱作为登录标识，不在此页面修改。",
    en: "Email is used as the login identity and cannot be changed here.",
  },
  avatarUpload: { zh: "头像上传", en: "Avatar Upload" },
  uploadImage: { zh: "上传图片", en: "Upload Image" },
  imageUploadHint: {
    zh: "支持 JPG / PNG / WEBP，最大 5MB。",
    en: "Supports JPG / PNG / WEBP, up to 5MB.",
  },
  newPassword: { zh: "新密码", en: "New Password" },
  keepPassword: {
    zh: "留空则保持当前密码",
    en: "Leave blank to keep the current password",
  },
  saveProfile: { zh: "保存资料", en: "Save Profile" },
  secureAccess: { zh: "安全登录", en: "Secure Access" },
  welcomeBack: {
    zh: "欢迎回到 LinguoSovereign",
    en: "Welcome back to LinguoSovereign",
  },
  registeredContinue: {
    zh: "注册成功，继续登录",
    en: "Account created, continue to sign in",
  },
  loginHeroTitle: {
    zh: "登入后，直接回到你的练习工作台。",
    en: "Sign in and return straight to your training workspace.",
  },
  loginHeroDesc: {
    zh: "保留最近进度、历史评分和题组复盘，让单次训练真正变成可连续推进的工作流。",
    en: "Keep your latest progress, score history, and grouped review in one continuous workflow.",
  },
  unifiedEntry: { zh: "统一入口", en: "Unified Entry" },
  unifiedEntryDesc: {
    zh: "登录后直接进入 Dashboard 与数据面板。",
    en: "Enter the dashboard and analytics after sign-in.",
  },
  sessionSync: { zh: "会话同步", en: "Session Sync" },
  sessionSyncDesc: {
    zh: "更新资料后，头像与昵称能即时反馈到前端。",
    en: "Profile updates immediately reflect in the frontend.",
  },
  continuousPractice: { zh: "连续练习", en: "Continuous Practice" },
  continuousPracticeDesc: {
    zh: "支持从模块页继续进入下一套或下一部分。",
    en: "Continue directly to the next set or part from module pages.",
  },
  backPrevious: { zh: "返回上一页", en: "Back to Previous Page" },
  signIn: { zh: "登录并进入工作台", en: "Sign In and Enter Workspace" },
  validating: { zh: "验证中...", en: "Verifying..." },
  noAccount: { zh: "还没有账号？", en: "No account yet?" },
  createAccount: { zh: "创建新账户", en: "Create Account" },
  loginFailed: {
    zh: "登录失败：邮箱或密码错误。",
    en: "Sign-in failed: incorrect email or password.",
  },
  accountCreatedLogin: {
    zh: "账户已创建，现在可以用刚刚的邮箱和密码登录。",
    en: "Your account has been created. You can now sign in with the same email and password.",
  },
  candidateOnboarding: { zh: "候选人加入", en: "Candidate Onboarding" },
  registerHeroTitle: {
    zh: "创建账户，然后把训练、评分和复盘放进同一条路径。",
    en: "Create your account and keep training, scoring, and review in one path.",
  },
  registerTip1: {
    zh: "账号创建后即可使用阅读、听力、写作、口语四大模块。",
    en: "After account creation, you can access Reading, Listening, Writing, and Speaking.",
  },
  registerTip2: {
    zh: "历史成绩与模考记录会绑定到你的账户，方便连续复盘。",
    en: "Historical scores and mock-test records stay attached to your account.",
  },
  registerTip3: {
    zh: "注册完成会自动跳到登录页，并带上成功提示。",
    en: "After registration, you will be redirected to sign-in with a success message.",
  },
  joinApp: { zh: "加入 LinguoSovereign", en: "Join LinguoSovereign" },
  registerFailed: { zh: "注册失败", en: "Registration failed" },
  networkErrorRetry: {
    zh: "网络错误，请稍后重试。",
    en: "Network error. Please try again later.",
  },
  atLeast6: { zh: "至少 6 位", en: "At least 6 characters" },
  registering: { zh: "注册中...", en: "Creating account..." },
  existingAccount: { zh: "已有账号？", en: "Already have an account?" },
  returnToLogin: { zh: "返回登录", en: "Back to Sign In" },
  analyticsTitle: { zh: "数据控制台", en: "Analytics Dashboard" },
  analyticsSubtitle: { zh: "你的 AI 备考报告", en: "your AI prep report" },
  totalTests: { zh: "总练习次数", en: "Total Attempts" },
  focusTime: { zh: "专注时长", en: "Focus Time" },
  readingEstimate: { zh: "阅读估分", en: "Reading Estimate" },
  writingEstimate: { zh: "写作估分", en: "Writing Estimate" },
  ieltsAverage: { zh: "雅思标准(均分)", en: "IELTS scale (avg)" },
  aiAverage: { zh: "AI 深度评估(均分)", en: "AI evaluation (avg)" },
  growthTrend: {
    zh: "成长轨迹 (最近测试)",
    en: "Progress Trend (Recent Tests)",
  },
  noData: { zh: "暂无数据记录", en: "No records yet" },
  averageScoresByModule: { zh: "模考模块均分", en: "Average Scores by Module" },
  detailedHistory: { zh: "详细练习记录", en: "Detailed Attempt History" },
  submissionTime: { zh: "交卷时间", en: "Submitted At" },
  module: { zh: "模块", en: "Module" },
  testTitle: { zh: "卷宗题目", en: "Unit Title" },
  estimatedBand: { zh: "雅思估分", en: "Estimated Band" },
  duration: { zh: "耗时", en: "Duration" },
  details: { zh: "详情", en: "Details" },
  notEvaluated: { zh: "未评估", en: "Not Evaluated" },
  explanation: { zh: "详解", en: "Reference" },
  noSubmissions: { zh: "暂无考卷提交记录", en: "No submissions yet" },
  minutes: { zh: "分钟", en: "min" },
  originalText: { zh: "原文", en: "Original" },
  translation: { zh: "译文", en: "Translation" },
  showAnswers: { zh: "显示答案", en: "Show Answers" },
  hideAnswers: { zh: "隐藏答案", en: "Hide Answers" },
  answerQuestion: { zh: "答题", en: "Answer" },
  transcript: { zh: "听力原文", en: "Transcript" },
  aiSpeakingCard: { zh: "AI 对话题卡", en: "AI Prompt Card" },
  liveMock: { zh: "自由对话训练", en: "Free Conversation" },
  speakingLikeExaminer: {
    zh: "像真人考官一样连续对话",
    en: "Talk continuously like a real examiner",
  },
  aiThinking: { zh: "AI 思考中", en: "AI Thinking" },
  listeningToYou: { zh: "正在听你说", en: "Listening to You" },
  aiCoaching: { zh: "AI 正在对话", en: "AI in Conversation" },
  readyToStart: { zh: "待开始", en: "Ready" },
  startAiConversation: { zh: "开启自由对话", en: "Start Free Conversation" },
  endConversation: { zh: "停止对话", en: "Stop Conversation" },
  myTurn: { zh: "轮到我回答", en: "My Turn to Answer" },
  aiSpeakingHint: {
    zh: "自由对话模式已切到 Gemini Live 原生语音链路：浏览器采集麦克风，模型直接返回原生音频，并同步给出输入/输出转录。停止对话只会关闭会话，不会清空当前记录。",
    en: "Free conversation now runs on Gemini Live native voice: the browser captures microphone audio, the model returns native audio, and both input/output transcriptions are streamed into the transcript. Stopping only closes the live session and keeps the current transcript on the page.",
  },
  clickToStartAi: {
    zh: "点击“开启自由对话”后，系统会先建立 Gemini Live 会话，再由 AI 先开场。后续你可以直接用麦克风自然接话；停止对话不会清空当前记录。",
    en: 'Click "Start Free Conversation" to establish a Gemini Live session first. The AI will open the exchange, then you can continue naturally by voice. Stopping will not clear the current conversation.',
  },
  speakingTranscriptMode: { zh: "转录评分", en: "Transcript Scoring" },
  speakingFreeChatMode: { zh: "自由对话", en: "Free Conversation" },
  speakingModeSwitcher: { zh: "口语训练模式", en: "Speaking Training Mode" },
  speakingTranscriptTitle: { zh: "语音转录评分", en: "Speech-to-Score" },
  speakingTranscriptBadge: { zh: "转录后评分", en: "Transcribe and Score" },
  speakingTranscriptHint: {
    zh: "系统会先把你的回答转成文本，训练依靠自觉，不建议手动修订，不要欺骗自己！最后会请求 AI 按 IELTS 口语维度评分。",
    en: "Your response is transcribed first. It is not appropriate to edit the transcript before requesting IELTS-style speaking feedback. Do not Deveive yourself!",
  },
  speakingCompleteAllPartsHint: {
    zh: "请按 Part 1 / Part 2 / Part 3 逐题完成，全部写完后才会进入最终评分。",
    en: "Complete Part 1, Part 2, and Part 3 before requesting the final speaking evaluation.",
  },
  speakingCompleteAllParts: {
    zh: "请先完成全部口语部分，再统一提交评分。",
    en: "Please complete every speaking part before submitting for evaluation.",
  },
  speakingTranscriptPlaceholder: {
    zh: "使用录音按钮开始转录，或直接手动输入你的口语回答...",
    en: "Use the recording button to transcribe your answer, or type your spoken response manually...",
  },
  speakingStartRecording: { zh: "开始转录", en: "Start Transcription" },
  speakingStopRecording: { zh: "停止转录", en: "Stop Transcription" },
  speakingTranscriptLabel: { zh: "转录文本", en: "Transcript" },
  speakingPromptBundle: { zh: "训练题卡", en: "Training Prompt Bundle" },
  speakingScoreReady: {
    zh: "口语评分已生成",
    en: "Speaking evaluation is ready",
  },
  speakingResponseTitle: {
    zh: "整理你的口语转录",
    en: "Refine Your Transcript",
  },
  freeConversationTitle: {
    zh: "AI 自由对话陪练",
    en: "AI Free Speaking Partner",
  },
  freeConversationBadge: { zh: "Gemini Live 原生语音", en: "Gemini Live Native Voice" },
  streamingReply: { zh: "AI 正在语音回复", en: "AI is replying in voice" },
  conversationTranscript: { zh: "对话记录", en: "Conversation Transcript" },
  clearConversation: { zh: "清空对话", en: "Clear Conversation" },
  streamingUnavailable: {
    zh: "当前未收到流式回复，请稍后重试。",
    en: "No streamed reply was received. Please try again.",
  },
  promptWorkbench: { zh: "Prompt 工作台", en: "Prompt Workbench" },
  promptWorkbenchHint: {
    zh: "当前模式会先加载默认提示词。你可以直接改写后再发起评分或对话，本次请求会优先使用这里的版本。",
    en: "This mode loads the default prompt first. You can rewrite it here before scoring or chatting, and this request will use the edited version first.",
  },
  promptLoading: { zh: "正在加载提示词...", en: "Loading prompt..." },
  promptName: { zh: "当前提示词", en: "Current prompt" },
  promptFallbackName: { zh: "内置默认提示词", en: "Built-in default prompt" },
  promptEditorLabel: { zh: "可编辑提示词", en: "Editable prompt" },
  promptRefresh: { zh: "恢复默认", en: "Restore Default" },
  promptEmpty: {
    zh: "当前没有可用提示词，请直接在这里输入。",
    en: "No prompt is available yet. Start typing here directly.",
  },
  promptLoadFailed: {
    zh: "提示词加载失败，已回退到手动编辑。",
    en: "Prompt loading failed. Falling back to manual editing.",
  },
  promptOpen: { zh: "展开 Prompt", en: "Open Prompt" },
  promptClose: { zh: "收起 Prompt", en: "Close Prompt" },
  currentQuestionLabel: { zh: "当前题目", en: "Current Prompt" },
  questionCompleted: { zh: "已完成", en: "Done" },
  questionOpen: { zh: "待回答", en: "Open" },
  previousQuestion: { zh: "上一题", en: "Previous" },
  nextQuestion: { zh: "下一题", en: "Next" },
  browserNoSpeech: {
    zh: "当前浏览器不支持实时语音识别。请使用 Chrome 或 Edge。",
    en: "This browser does not support realtime speech recognition. Please use Chrome or Edge.",
  },
  aiConversationFailed: { zh: "AI 对话失败", en: "AI conversation failed" },
  speechRecognitionFailed: {
    zh: "语音识别失败。请检查麦克风权限，或改用 Chrome / Edge。",
    en: "Speech recognition failed. Check microphone permissions or try Chrome / Edge.",
  },
  audioPlaybackUnsupported: {
    zh: "当前浏览器不支持 Gemini Live 的实时音频播放。请使用最新版 Chrome 或 Edge。",
    en: "This browser does not support realtime audio playback for Gemini Live. Please use the latest Chrome or Edge.",
  },
  language: { zh: "语言", en: "Language" },
  password: { zh: "密码", en: "Password" },
  noPassageOrTranscript: {
    zh: "无阅读文本或听力底稿",
    en: "No reading passage or listening transcript available.",
  },
  reviewLabel: { zh: "详解", en: "Review" },
  savedWithoutAi: { zh: "已保存，未 AI 评估", en: "Saved, not AI evaluated" },
  subjectiveEvaluationKey: {
    zh: "主观题评估总览",
    en: "Subjective Evaluation Overview",
  },
  promptContext: { zh: "提示文本", en: "Prompt Context" },
  questionsAndReferences: {
    zh: "题目与参考解答",
    en: "Questions & References",
  },
  sampleAnswer: { zh: "参考答案", en: "Sample Answer" },
  sampleAnswerPlaceholder: {
    zh: "参考答案暂未录入，先保留此占位框，后续可补充标准范文或官方答案。",
    en: "Sample answer has not been added yet. This placeholder stays here until a model answer or official sample is provided.",
  },
  analysisLabel: { zh: "题目解析", en: "Analysis" },
  yourResponse: { zh: "你的作答", en: "Your Response" },
  responseItem: { zh: "作答", en: "Response" },
  answerItem: { zh: "答案", en: "Answer" },
  noContentProvided: { zh: "未作答", en: "No Content Provided" },
  aiCriticalAnalysis: { zh: "AI 深度分析", en: "AI Critical Analysis" },
  savedOnlyNoAiNote: {
    zh: "这次提交只保存了答案，还没有请求 AI 判分。你之后可以回到答题页，再选择“AI 判分并给建议”。",
    en: "This submission only saved your response and did not request AI scoring yet. You can return to the test page later and choose AI Score and Feedback.",
  },
  part: { zh: "Part", en: "Part" },
  structuredWriting: { zh: "结构化写作", en: "Structured Writing" },
  evaluationReady: {
    zh: "已生成本题型评估结果",
    en: "Evaluation is ready for this task",
  },
  submissionSaved: { zh: "提交已保存", en: "Submission Saved" },
  saveOnlySavedDesc: {
    zh: "普通提交只会把答案保存到服务器，不会立即请求 AI 评分。你之后可以再回来选择 AI 判分。",
    en: "Save Only keeps the response on the server without requesting AI scoring right away. You can come back later and run AI evaluation.",
  },
  recommendedRemaining: { zh: "建议剩余", en: "Recommended remaining" },
  score: { zh: "得分", en: "Score" },
  fullSubmit: { zh: "全卷提交", en: "Submit All" },
  answeringInProgress: { zh: "答题中", en: "In Progress" },
  listeningAudioTranscript: {
    zh: "听力音频与原文",
    en: "Listening Audio & Transcript",
  },
  readingMaterial: { zh: "阅读文章", en: "Reading Material" },
  hideTranscript: { zh: "隐藏原文", en: "Hide Transcript" },
  showTranscript: { zh: "查看原文", en: "Show Transcript" },
  audioUnsupported: {
    zh: "您的浏览器不支持音频播放。",
    en: "Your browser does not support audio playback.",
  },
  transcriptHiddenDuringListening: {
    zh: "听力测试期间，原文已隐藏",
    en: "The transcript is hidden during the listening test.",
  },
  focusOnAudio: { zh: "请专注听录音内容", en: "Focus on the audio." },
  transcriptCollapsed: {
    zh: "听力文本默认隐藏",
    en: "The transcript is collapsed by default.",
  },
  clickToExpandTranscript: {
    zh: "点击展开原文进行精听",
    en: "Click to expand the transcript for review.",
  },
  blueHighlight: { zh: "蓝划线", en: "Blue" },
  yellowHighlight: { zh: "黄划线", en: "Yellow" },
  cancel: { zh: "取消", en: "Cancel" },
  allCorrect: { zh: "全部正确", en: "All correct" },
  containsErrors: { zh: "含有错误答案", en: "Contains incorrect answers" },
  showAnalysis: { zh: "显示解析", en: "Show Analysis" },
  hideAnalysis: { zh: "收起解析", en: "Hide Analysis" },
  yourAnswer: { zh: "你的答案", en: "Your Answer" },
  correctAnswer: { zh: "正确答案", en: "Correct Answer" },
  questionImage: { zh: "题目配图", en: "Question Illustration" },
} as const;

export type I18nKey = keyof typeof I18N;

export function getCopy(locale: Locale, key: I18nKey) {
  return I18N[key][locale];
}

export function getCategoryLabel(locale: Locale, category: string) {
  return CATEGORY_LABELS[locale][category] ?? category;
}

export function formatLocaleDate(
  locale: Locale,
  value: string | number | Date,
) {
  return new Date(value).toLocaleString(locale === "zh" ? "zh-CN" : "en-US");
}
