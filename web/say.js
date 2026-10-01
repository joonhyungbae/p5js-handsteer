/*
 관객의 폰에서 여는 자리. 한 문장을 적어 serve.py 로 보낸다.

 보낸 문장은 /says.json 을 거쳐 전시장 화면(words.js)으로 올라간다. 설치 없이 보는 주소에는
 받아 둘 서버가 없어서 보내기가 되지 않는다. 그때는 그렇다고 알린다.
*/

const $ = (id) => document.getElementById(id);
const form = $("form"), text = $("text"), send = $("send"), left = $("left"), said = $("said"), mine = $("mine");

text.addEventListener("input", () => (left.textContent = String(60 - text.value.length)));

// 폰 자판의 보내기로도 넘어가게 한다
text.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const t = text.value.replace(/\s+/g, " ").trim();
  if (!t) return;
  send.disabled = true;
  said.textContent = "보내는 중";
  try {
    const res = await fetch("say", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    });
    const d = res.ok ? await res.json() : null;
    if (!d?.ok) throw new Error(res.status);
    said.innerHTML = `화면으로 올라갔습니다. 지금까지 <b>${d.count}</b> 문장`;
    const li = document.createElement("li");
    li.textContent = t;
    mine.prepend(li);
    text.value = "";
    left.textContent = "60";
  } catch {
    said.textContent = "보내지 못했습니다. 전시장의 안내 주소로 다시 열어 주세요";
  } finally {
    send.disabled = false;
    text.focus();
  }
});

text.focus();
