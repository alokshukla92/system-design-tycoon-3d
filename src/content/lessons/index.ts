// Lesson data (generated once by scripts/convert-lessons.mjs, then committed). Maps lesson id → lesson.
// JSON imports are structurally widened (string instead of literal unions), hence the cast;
// content.test.ts validates every lesson against the schema and registries.
import type { Lesson } from "../../types/lesson";
import dayOne from "./day-one.json";
import theSlowBurn from "./the-slow-burn.json";
import chatterbox from "./chatterbox.json";
import the3amPage from "./the-3am-page.json";
import pictureThis from "./picture-this.json";
import aMillionLittleWrites from "./a-million-little-writes.json";
import surge from "./surge.json";
import checkout from "./checkout.json";
import theStreamMustFlow from "./the-stream-must-flow.json";
import planetScale from "./planet-scale.json";
import codeRed from "./code-red.json";
import theCacheThatSavedTooWell from "./the-cache-that-saved-too-well.json";
import eightMillionMessagesBehind from "./eight-million-messages-behind.json";
import oneShardToRuleThemAll from "./one-shard-to-rule-them-all.json";
import theRegionIsDown from "./the-region-is-down.json";
import searchMovesOut from "./search-moves-out.json";

const ALL = [
  dayOne,
  theSlowBurn,
  chatterbox,
  the3amPage,
  pictureThis,
  aMillionLittleWrites,
  surge,
  checkout,
  theStreamMustFlow,
  planetScale,
  codeRed,
  theCacheThatSavedTooWell,
  eightMillionMessagesBehind,
  oneShardToRuleThemAll,
  theRegionIsDown,
  searchMovesOut,
] as unknown as Lesson[];

export const LESSONS: Record<string, Lesson> = Object.fromEntries(ALL.map((l) => [l.id, l]));
