/**
 * 口语实时对话接口 (Live Speaking AI Route)
 * 作用：处理前端发来的用户语音/文字回复，并调用 AI 模拟雅思口语考官进行对话。
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiClient, getSpeakingConversationModel } from "@/lib/ai";

// 定义对话历史记录的类型
type SpeakingHistoryItem = {
  role: "assistant" | "user"; // 发言者：AI助手 或 用户
  text?: string;
  content?: string;
};

/**
 * 处理 POST 请求
 * 前端会把用户的最新回复和之前的对话历史传过来。
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 权限校验：检查用户是否登录
    const session = await getServerSession(authOptions);
    if (!session?.user || !("id" in session.user)) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // 2. 获取并解析前端传来的数据
    const body = (await req.json()) as {
      unitId?: string; // 题目单元 ID
      history?: SpeakingHistoryItem[]; // 之前的对话记录
      userMessage?: string; // 用户最新说的一句话
    };

    // 校验输入数据是否完整
    if (!body.unitId || !body.userMessage?.trim()) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // 3. 从数据库中查找题目内容
    // 作用：让 AI 知道现在是在考哪道题，这样考官才能针对性提问。
    const unit = await prisma.questionUnit.findUnique({
      where: { id: body.unitId },
      include: { questions: { orderBy: { serialNumber: "asc" } } },
    });

    if (!unit) {
      return NextResponse.json(
        { error: "Speaking unit not found" },
        { status: 404 },
      );
    }

    // 把题目内容拼接成一个纯文本，喂给 AI
    const promptText = unit.questions
      .map((question) => question.stem.replace(/<[^>]*>?/gm, " ").trim())
      .join("\n\n");

    // 4. 调用 AI (OpenAI)
    const client = getAiClient();
    const completion = await client.chat.completions.create({
      model: getSpeakingConversationModel(), // 使用口语专用模型
      messages: [
        // 设定 AI 的“人设”
        {
          role: "system",
          content:
            "你是一个专业的雅思口语考官，正在进行一场真实的模拟面试。 \
            保持互动自然、亲切且简洁。一次只问一个追问或给出一个简短回应。 \
            现在不要打分。全程使用英文口语交流。\
            每条回复保持在 80 个单词以内。",
        },
        // 告诉 AI 考试背景
        {
          role: "system",
          content: `当前口语题目背景 (Current speaking prompt context):\n${promptText}`,
        },
        // 传入之前的对话历史，让 AI 有“记忆”
        ...((body.history || []).map((item) => ({
          role: item.role,
          content: item.text || item.content || "",
        })) as Array<{ role: "assistant" | "user"; content: string }>),
        // 传入用户最新说的话
        {
          role: "user",
          content: body.userMessage.trim(),
        },
      ],
    });

    // 5. 获取 AI 的回复内容
    const reply = completion.choices[0]?.message?.content?.trim();

    if (!reply) {
      return NextResponse.json({ error: "AI reply is empty" }, { status: 502 });
    }

    // 6. 返回结果给前端
    return NextResponse.json({ data: { reply } });
  } catch (error) {
    // 错误处理：如果 AI 挂了或者网络不通
    console.error("API Error: POST /api/speaking/live -", error);
    return NextResponse.json(
      {
        error: "AI speaking conversation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
