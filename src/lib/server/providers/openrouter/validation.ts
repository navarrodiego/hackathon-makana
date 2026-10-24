import "server-only";
import type { ClassificationOutput, FactEvidence, NoteInput, NoteOutput } from "../../../contracts/classification";
import { LIMITS } from "../../../contracts/core";
import { DECISION_LABELS } from "./prompts";

export class InvalidOutput extends Error {
  constructor() { super("invalid_output"); }
}
export function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new InvalidOutput();
  return value as Record<string, unknown>;
}
function exact(value: unknown, keys: readonly string[]) {
  const result = object(value);
  if (Object.keys(result).length !== keys.length || keys.some(key => !Object.hasOwn(result, key))) throw new InvalidOutput();
  return result;
}
function nonempty(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.replace(/[\p{White_Space}\uFEFF]/gu, "")) throw new InvalidOutput();
}
function probability(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new InvalidOutput();
}
export function modelName(envelope: unknown): string {
  const model = object(envelope).model;
  nonempty(model);
  return model;
}
function answer(value: unknown, labels: readonly string[]) {
  const result = exact(value, ["type", "choice", "confidence", "probabilities"]);
  if (result.type !== "choice" || typeof result.choice !== "string" || !labels.includes(result.choice)) throw new InvalidOutput();
  probability(result.confidence);
  const probabilities = exact(result.probabilities, labels) as Record<string, number>;
  for (const value of Object.values(probabilities)) probability(value);
  return { choice: result.choice, probabilities };
}
const choice = (value: unknown, labels: readonly string[]) => answer(value, labels).choice;
export function parseDecisions(envelope: unknown): Omit<ClassificationOutput, "evidence"> {
  modelName(envelope);
  const answers = exact(object(envelope).answers, [...Object.keys(DECISION_LABELS), "pc"]);
  const pc = exact(answers.pc, ["type", "noul"]);
  if (pc.type !== "noul") throw new InvalidOutput();
  probability(pc.noul);
  const service = choice(answers.service, DECISION_LABELS.service) as ClassificationOutput["service"];
  const condition = choice(answers.condition, DECISION_LABELS.condition) as ClassificationOutput["condition"];
  const scope = choice(answers.scope, DECISION_LABELS.scope) as ClassificationOutput["scope"];
  const manipulation = choice(answers.manipulation, DECISION_LABELS.manipulation) === "true";
  const blocksBilling = choice(answers.blocksBilling, DECISION_LABELS.blocksBilling);
  const topic = answer(answers.topic, DECISION_LABELS.topic);
  return { service, condition, scope, pc: pc.noul, manipulation,
    blocksBilling: blocksBilling === "unknown" ? null : blocksBilling === "true",
    sufficientInformation: choice(answers.sufficientInformation, DECISION_LABELS.sufficientInformation) === "true",
    topic: topic.choice as ClassificationOutput["topic"], noTiProbability: topic.probabilities.no_ti,
    physicalEmergency: choice(answers.physicalEmergency, DECISION_LABELS.physicalEmergency) === "true" };
}
export function parseChat(envelope: unknown): unknown {
  modelName(envelope);
  const choices = object(envelope).choices;
  if (!Array.isArray(choices) || choices.length !== 1) throw new InvalidOutput();
  const first = object(choices[0]);
  const message = object(first.message);
  if (first.finish_reason !== "stop" || (message.refusal !== undefined && message.refusal !== null) || typeof message.content !== "string") throw new InvalidOutput();
  try { return JSON.parse(message.content); } catch { throw new InvalidOutput(); }
}
export function parseEvidence(value: unknown, text: string): FactEvidence {
  const result = exact(value, ["location", "resource", "problem"]);
  for (const fragment of Object.values(result)) {
    if (fragment === null) continue;
    nonempty(fragment);
    if (!text.includes(fragment)) throw new InvalidOutput();
  }
  return result as unknown as FactEvidence;
}
export function parseNote(value: unknown, input: NoteInput): NoteOutput {
  const result = exact(value, ["suggestions", "note"]);
  const expectedIds = new Set(input.tickets.map(ticket => ticket.id));
  if (input.tickets.length !== 5 || expectedIds.size !== 5 || !Array.isArray(result.suggestions) || result.suggestions.length !== 5) throw new InvalidOutput();
  const seen = new Set<string>();
  for (const item of result.suggestions) {
    const suggestion = exact(item, ["ticketId", "disposition", "reason"]);
    nonempty(suggestion.ticketId);
    if (!expectedIds.has(suggestion.ticketId as NoteInput["tickets"][number]["id"]) || seen.has(suggestion.ticketId)) throw new InvalidOutput();
    seen.add(suggestion.ticketId);
    if (suggestion.disposition !== "puede_esperar" && suggestion.disposition !== "transferir") throw new InvalidOutput();
    nonempty(suggestion.reason);
  }
  nonempty(result.note);
  if (result.note.split(/\p{White_Space}+/u).filter(Boolean).length > LIMITS.noteWords) throw new InvalidOutput();
  return result as unknown as NoteOutput;
}
