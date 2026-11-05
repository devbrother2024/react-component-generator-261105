import { describe, it, expect } from 'vitest';
import { stripStreamingFences } from './streamingCode';

describe('stripStreamingFences', () => {
  it('앞쪽의 언어 태그 붙은 펜스 줄을 제거한다', () => {
    expect(stripStreamingFences('```jsx\nconst A = 1;')).toBe('const A = 1;');
  });

  it('앞쪽의 언어 태그 없는 펜스 줄도 제거한다', () => {
    expect(stripStreamingFences('```\nconst A = 1;')).toBe('const A = 1;');
  });

  it('펜스 줄이 아직 다 도착하지 않았으면 빈 문자열을 돌려준다', () => {
    expect(stripStreamingFences('``')).toBe('');
    expect(stripStreamingFences('```js')).toBe('');
  });

  it('끝쪽의 닫는 펜스를 제거한다', () => {
    expect(stripStreamingFences('const A = 1;\n```')).toBe('const A = 1;');
  });

  it('닫는 펜스가 일부만 도착해도 제거한다', () => {
    expect(stripStreamingFences('const A = 1;\n``')).toBe('const A = 1;');
  });

  it('펜스가 없는 코드는 그대로 둔다', () => {
    expect(stripStreamingFences('const A = 1;\nrender(<A />);')).toBe('const A = 1;\nrender(<A />);');
  });

  it('줄 중간의 백틱(템플릿 리터럴)은 건드리지 않는다', () => {
    const code = 'const s = `hi`;';
    expect(stripStreamingFences(code)).toBe(code);
  });
});
