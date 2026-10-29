import { bellandhowellAmps } from "./bellandhowell.js";
import { bognerAmps } from "./bogner.js";
import { diezelAmps } from "./diezel.js";
import { driftwoodAmps } from "./driftwood.js";
import { dumbleAmps } from "./dumble.js";
import { earforceAmps } from "./earforce.js";
import { egnaterAmps } from "./egnater.js";
import { englAmps } from "./engl.js";
import { evhAmps } from "./evh.js";
import { fenderAmps } from "./fender.js";
import { friedmanAmps } from "./friedman.js";
import { hiwattAmps } from "./hiwatt.js";
import { krankAmps } from "./krank.js";
import { marshallAmps } from "./marshall.js";
import { mesaAmps } from "./mesa.js";
import { orangeAmps } from "./orange.js";
import { peaveyAmps } from "./peavey.js";
import { randallAmps } from "./randall.js";
import { redplateAmps } from "./redplate.js";
import { rolandAmps } from "./roland.js";
import { soldanoAmps } from "./soldano.js";
import { thirdPowerAmps } from "./thirdPower.js";
import { toneKingAmps } from "./toneKing.js";
import { voxAmps } from "./vox.js";
import { matchlessAmps } from "./matchless.js";
import { victoryAmps } from "./victory.js";
import { revvAmps } from "./revv.js";
import { riveraAmps } from "./rivera.js";
import { hugheskettnerAmps } from "./hughes-kettner.js";

/**
 * Sole amp registration list.
 * Add a new manufacturer file here — Live Companion and Gear Library both
 * consume this array through the library API.
 *
 * @type {import("../../library/ampLibrary.js").AmpRecord[]}
 */
export const allAmpRecords = [
  ...bellandhowellAmps,
  ...bognerAmps,
  ...diezelAmps,
  ...driftwoodAmps,
  ...dumbleAmps,
  ...earforceAmps,
  ...egnaterAmps,
  ...englAmps,
  ...evhAmps,
  ...fenderAmps,
  ...friedmanAmps,
  ...hiwattAmps,
  ...krankAmps,
  ...marshallAmps,
  ...mesaAmps,
  ...orangeAmps,
  ...peaveyAmps,
  ...randallAmps,
  ...redplateAmps,
  ...rolandAmps,
  ...soldanoAmps,
  ...thirdPowerAmps,
  ...toneKingAmps,
  ...voxAmps,
  ...matchlessAmps,
  ...victoryAmps,
  ...revvAmps,
  ...riveraAmps,
  ...hugheskettnerAmps
];
