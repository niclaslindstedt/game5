// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Text onto the clipboard, and whether it got there.
//
// The async clipboard is the right call and is refused in more places than
// it is granted — an insecure origin, a WebView with no permission, a
// document that has lost focus — so a refusal falls back to the old
// selection copy, which asks for nothing. The caller hears true or false
// and says so on the button; a copy that silently did nothing is a report
// somebody pastes as an empty message.

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
}

function legacyCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    // Deprecated and still the only copy that needs no permission.
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
