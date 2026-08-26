import crypto from "node:crypto";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
function signRequest(path: string, method: string, accessId: string, secret: string, token = "") {
  const timestamp = Date.now().toString(); const hash = crypto.createHash("sha256").update("").digest("hex"); const stringToSign = `${method}\n${hash}\n\n${path}`; const sign = crypto.createHmac("sha256", secret).update(accessId + token + timestamp + stringToSign).digest("hex").toUpperCase(); return { sign, timestamp };
}
export async function GET() {
  const accessId = process.env.TUYA_ACCESS_ID; const secret = process.env.TUYA_ACCESS_SECRET; const deviceId = process.env.TUYA_DEVICE_ID; const endpoint = "https://openapi.tuyaeu.com";
  if (!accessId || !secret || !deviceId) return NextResponse.json({ error: "Tuya server configuration is missing" }, { status: 503 });
  const tokenPath = "/v1.0/token?grant_type=1"; const tokenSignature = signRequest(tokenPath, "GET", accessId, secret);
  let tokenResponse: Response; try { tokenResponse = await fetch(endpoint + tokenPath, { headers: { client_id: accessId, sign: tokenSignature.sign, t: tokenSignature.timestamp, sign_method: "HMAC-SHA256" }, cache: "no-store" }); } catch { return NextResponse.json({ error: "Unable to reach Tuya Cloud" }, { status: 502 }); }
  const tokenBody = await tokenResponse.json(); const accessToken = tokenBody?.result?.access_token; if (!tokenResponse.ok || !tokenBody.success || typeof accessToken !== "string") return NextResponse.json({ error: tokenBody.msg ?? `Tuya token request failed (${tokenBody.code ?? tokenResponse.status})` }, { status: tokenResponse.status || 502 });
  const path = `/v1.0/devices/${deviceId}/status`; const signature = signRequest(path, "GET", accessId, secret, accessToken);
  let response: Response; try { response = await fetch(endpoint + path, { headers: { client_id: accessId, access_token: accessToken, sign: signature.sign, t: signature.timestamp, sign_method: "HMAC-SHA256" }, cache: "no-store" }); } catch { return NextResponse.json({ error: "Unable to reach Tuya Cloud" }, { status: 502 }); }
  const body = await response.json(); if (!response.ok || !body.success) return NextResponse.json({ error: body.msg ?? `Tuya request failed (${body.code ?? response.status})` }, { status: response.status || 502 });
  const values = Object.fromEntries((Array.isArray(body.result) ? body.result : []).map((item: { code: string; value: unknown }) => [item.code, item.value]));
  const numberValue = (value: unknown) => { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : null; };
  const rawVoltage = numberValue(values.cur_voltage); const rawCurrent = numberValue(values.cur_current); const rawPower = numberValue(values.cur_power); const rawEnergy = numberValue(values.add_ele);
  if (rawVoltage === null && rawCurrent === null) {
    return NextResponse.json({ error: "Tuya returned no voltage/current telemetry", availableCodes: Object.keys(values) }, { status: 502 });
  }
  return NextResponse.json({ voltage: rawVoltage === null ? null : rawVoltage / 10, current: rawCurrent === null ? null : rawCurrent / 1000, power: rawPower === null ? null : rawPower / 10, energy: rawEnergy === null ? null : rawEnergy / 1000, fault: values.fault ?? null, onlineState: values.online_state == null ? null : String(values.online_state), timestamp: new Date().toISOString(), availableCodes: Object.keys(values) });
}
