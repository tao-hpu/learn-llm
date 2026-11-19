/** 上一步 / 下一步。最后一步的「完成 🎉」由章节脚本改按钮文字并触发庆祝。 */
export function StepButtons({ prevClass }: { prevClass: string }) {
  const html = `<div class="nav"><button class="${prevClass}" id="prevBtn" type="button">← 上一步</button><button class="btn primary" id="nextBtn" type="button">下一步 →</button></div>`
  return <div className="shell-slot" dangerouslySetInnerHTML={{ __html: html }} />
}
