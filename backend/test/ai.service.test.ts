import { describe, it, expect, vi, beforeEach } from "vitest";

const { transcriptionsCreateMock, completionsCreateMock } = vi.hoisted(() => {
  const transcriptionsCreateMock = vi.fn();
  const completionsCreateMock = vi.fn();
  return { transcriptionsCreateMock, completionsCreateMock };
});

vi.mock("openai", () => {
  return {
    default: class {
      constructor() {
        return {
          audio: { transcriptions: { create: transcriptionsCreateMock } },
          chat: { completions: { create: completionsCreateMock } },
        };
      }
    },
  };
});

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

const { transcribeAudio, interpretMealText, AiParseError } = await import("../src/ai/ai.service.js");

beforeEach(() => {
  transcriptionsCreateMock.mockReset();
  completionsCreateMock.mockReset();
});

describe("transcribeAudio", () => {
  it("returns the transcribed text", async () => {
    transcriptionsCreateMock.mockResolvedValue({ text: "comí una milanesa con papas" });
    const text = await transcribeAudio(Buffer.from("fake-audio"), "audio/webm");
    expect(text).toBe("comí una milanesa con papas");
    expect(transcriptionsCreateMock).toHaveBeenCalledOnce();
  });

  it("throws AiParseError when the OpenAI call fails", async () => {
    transcriptionsCreateMock.mockRejectedValue(new Error("network down"));
    await expect(transcribeAudio(Buffer.from("fake-audio"), "audio/webm")).rejects.toBeInstanceOf(AiParseError);
  });
});

describe("interpretMealText", () => {
  it("parses a well-formed structured completion", async () => {
    completionsCreateMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ type: "Almuerzo", description: "Milanesa con papas fritas", calories: 750 }),
          },
        },
      ],
    });
    const guess = await interpretMealText("comí una milanesa con papas fritas");
    expect(guess).toEqual({ type: "Almuerzo", description: "Milanesa con papas fritas", calories: 750 });
  });

  it("throws AiParseError when the completion fails", async () => {
    completionsCreateMock.mockRejectedValue(new Error("quota exceeded"));
    await expect(interpretMealText("comí algo")).rejects.toBeInstanceOf(AiParseError);
  });

  it("throws AiParseError when the response doesn't match the expected shape", async () => {
    completionsCreateMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "NoExiste", description: "x", calories: "mucho" }) } }],
    });
    await expect(interpretMealText("comí algo")).rejects.toBeInstanceOf(AiParseError);
  });

  it("throws AiParseError when the completion has no content", async () => {
    completionsCreateMock.mockResolvedValue({ choices: [{ message: {} }] });
    await expect(interpretMealText("comí algo")).rejects.toBeInstanceOf(AiParseError);
  });
});
