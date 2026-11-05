/** 12x12 픽셀 로고: 줄무늬 타이틀바가 있는 창 안에 < > */
export function PixelLogo({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="0" y="1" width="12" height="10" fill="#000" />
      <rect x="1" y="2" width="10" height="1" fill="#ffd23f" />
      <rect x="1" y="4" width="10" height="6" fill="#fff" />
      <rect x="4" y="5" width="1" height="1" />
      <rect x="3" y="6" width="1" height="1" />
      <rect x="4" y="7" width="1" height="1" />
      <rect x="7" y="5" width="1" height="1" />
      <rect x="8" y="6" width="1" height="1" />
      <rect x="7" y="7" width="1" height="1" />
    </svg>
  );
}

/** 20x24 픽셀 매킨토시: 비어 있는 화면을 위한 일러스트 */
export function PixelMac({ size = 120 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 24) / 20}
      viewBox="0 0 20 24"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="20" height="22" fill="#000" />
      <rect x="1" y="1" width="18" height="20" fill="#ddd" />
      <rect x="3" y="3" width="14" height="11" fill="#000" />
      <rect x="4" y="4" width="12" height="9" fill="#fff" />
      <rect x="7" y="6" width="1" height="2" fill="#000" />
      <rect x="12" y="6" width="1" height="2" fill="#000" />
      <rect x="6" y="9" width="1" height="1" fill="#000" />
      <rect x="13" y="9" width="1" height="1" fill="#000" />
      <rect x="7" y="10" width="6" height="1" fill="#000" />
      <rect x="5" y="17" width="10" height="1" fill="#000" />
      <rect x="15" y="19" width="2" height="1" fill="#ffd23f" />
      <rect x="2" y="22" width="16" height="2" fill="#000" />
    </svg>
  );
}
