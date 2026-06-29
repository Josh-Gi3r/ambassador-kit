import { callDataApi } from "../server/_core/dataApi.js";

async function main() {
  try {
    const result = await callDataApi("Twitter/get_user_profile_by_username", {
      query: { username: "yourbrandhandle" },
    });
    console.log("Top-level keys:", Object.keys(result || {}));
    console.log("Full result (truncated):", JSON.stringify(result, null, 2).slice(0, 2000));
  } catch (e) {
    console.error("Error:", e.message);
  }
}
main();
