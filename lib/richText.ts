const tags = new Set(['b','strong','i','em','u','s','strike','span','font','br','div','p']);
export const hasRichText = (text: string) => /<\/?(?:b|strong|i|em|u|s|strike|span|font|br|div|p)(?:\s|\/?>)/i.test(text);
export const escapeText = (text: string) => text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function sanitizeRichText(text: string): string {
  if (!hasRichText(text)) return escapeText(text);
  return text.replace(/<!--[\s\S]*?-->|<[^>]*>/g, token => {
    const match = token.match(/^<(\/?)([a-z]+)\b([^>]*)>/i);
    if (!match || !tags.has(match[2].toLowerCase())) return '';
    const tag = match[2].toLowerCase();
    if (match[1]) return `</${tag}>`;
    const styles: string[] = [];
    const style = match[3].match(/\bstyle\s*=\s*["']([^"']*)["']/i)?.[1] || '';
    for (const rule of style.split(';')) {
      const [key, value] = rule.split(':').map(x=>x.trim().toLowerCase());
      if ((key==='color'||key==='background-color') && /^(#[\da-f]{3,8}|rgba?\([\d.,%\s]+\)|transparent|black|white|red|blue|green|yellow)$/.test(value || '')) styles.push(`${key}:${value}`);
      if (key==='font-weight' && /^(bold|[1-9]00)$/.test(value)) styles.push(`${key}:${value}`);
      if (key==='font-style' && value==='italic') styles.push(`${key}:${value}`);
      if ((key==='text-decoration'||key==='text-decoration-line') && /^(underline|line-through)( (underline|line-through))?$/.test(value)) styles.push(`${key}:${value}`);
    }
    const color = match[3].match(/\bcolor\s*=\s*["'](#[\da-f]{3,8})["']/i)?.[1];
    if(color) styles.push(`color:${color}`);
    return `<${tag}${styles.length ? ` style="${styles.join(';')}"` : ''}>`;
  });
}
export function plainText(text: string): string {
  const value = hasRichText(text) ? text.replace(/<br\s*\/?>|<\/div>|<\/p>/gi,'\n').replace(/<[^>]*>/g,'') : text;
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, entity: string) => {
    if(entity[0]==='#') {const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}
    return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '} as Record<string,string>)[entity.toLowerCase()] || all;
  });
}
