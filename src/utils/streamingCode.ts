// 스트리밍 중인 응답을 코드 뷰에 보여주기 위한 표시용 정리.
// 최종 코드의 정규화는 서버(`stripCodeFences` / `ensureRenderCall`)가 맡는다.

export function stripStreamingFences(raw: string): string {
  return raw
    .replace(/^\s*`{1,3}[a-zA-Z]*(?:\n|$)/, '')
    .replace(/\n`{1,3}\s*$/, '');
}
