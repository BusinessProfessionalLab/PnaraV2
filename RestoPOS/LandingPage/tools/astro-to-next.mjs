// Generate the Next.js build (next/) from the Astro source (src/).
//
// Astro is the source of truth. This script parses every .astro file with
// Astro's own compiler (an ESTree + JSX AST), rewrites only what React spells
// differently, and writes the matching .tsx. Markup, class names, data hooks
// and copy stay byte-identical, so the two builds cannot drift in layout:
//
//   class / class:list        -> className / className={cx(...)}
//   set:html={x}              -> dangerouslySetInnerHTML={{ __html: x }}
//   style="css" | style={x}   -> style={sx(...)}  (CSS text parsed at render)
//   for, tabindex, srcset ... -> htmlFor, tabIndex, srcSet ...
//   data-x (no value)         -> data-x=""  (React would print "true")
//   <slot />                  -> {children}
//   <slot name="a-b" />       -> {aB}, and the caller's <x slot="a-b"> moves into an aB={...} prop
//   <X><Content /></X>        -> <X dangerouslySetInnerHTML={{ __html: Content.html }} /> (rendered Markdown)
//   <style>, <!-- -->         -> dropped (styles: tools/collect-css.mjs)
//   const {..} = Astro.props  -> function parameters
//   import.meta.env.PUBLIC_*  -> process.env.NEXT_PUBLIC_*
//   'astro:content'           -> '@/lib/collections' (hand-written, same API)
//   pages/x.astro             -> app/x/page.tsx (getStaticPaths -> generateStaticParams)
//
// Hand-written Next counterparts (not generated): src/layouts/{Base,Bare,Head}.tsx,
// src/components/GoogleAnalytics.tsx, src/lib/collections.ts, src/app/layout.tsx,
// src/app/Scripts.tsx, src/app/sitemap.ts, src/app/robots.ts.
// Anything the script does not understand fails the run, rather than being
// passed through silently.
import { parse } from '../node_modules/@astrojs/compiler-rs/dist/index.mjs';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, relative, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const A = join(ROOT, 'src');
const N = join(ROOT, 'next', 'src');
const SITE = 'https://parley-next.startfrom.co';
const HAND = new Set(['layouts/Base.astro', 'layouts/Bare.astro', 'layouts/Head.astro', 'components/GoogleAnalytics.astro']);
const errors = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

const walkDir = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walkDir(join(d, f)) : [join(d, f)]));
const ASTRO_API = /\bAstro\.(props|url|site|generator|glob|request|params|slots|self|cookies|redirect|locals|clientAddress|currentLocale)\b/;
const camel = (s) => s.replace(/[-:]([a-z])/g, (_, c) => c.toUpperCase());

// ---------------------------------------------------------------- attributes
const DOM_ATTR = {
  for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength', minlength: 'minLength',
  autocomplete: 'autoComplete', autofocus: 'autoFocus', srcset: 'srcSet', fetchpriority: 'fetchPriority',
  crossorigin: 'crossOrigin', enctype: 'encType', novalidate: 'noValidate', inputmode: 'inputMode',
  spellcheck: 'spellCheck', colspan: 'colSpan', rowspan: 'rowSpan', playsinline: 'playsInline', autoplay: 'autoPlay',
  allowfullscreen: 'allowFullScreen', frameborder: 'frameBorder', referrerpolicy: 'referrerPolicy',
  contenteditable: 'contentEditable', accesskey: 'accessKey', datetime: 'dateTime', 'accept-charset': 'acceptCharset',
  'xlink:href': 'xlinkHref', 'xml:space': 'xmlSpace', 'xmlns:xlink': 'xmlnsXlink', class: 'className',
};
function domAttrName(name) {
  if (DOM_ATTR[name]) return DOM_ATTR[name];
  if (name.startsWith('data-') || name.startsWith('aria-')) return name;
  if (name.includes('-') || name.includes(':')) return camel(name); // SVG presentation attributes
  return name;
}

// ---------------------------------------------------------------- imports
function mapImport(spec, fromFile) {
  if (spec.endsWith('.css')) return null;
  if (spec === 'astro:content') return '@/lib/collections';
  if (spec.startsWith('@vercel/')) return null;
  if (spec.startsWith('astro')) return undefined; // anything else from Astro is unsupported
  if (!spec.startsWith('.')) return spec;
  const abs = resolve(dirname(fromFile), spec);
  return '@/' + relative(A, abs).replace(/\\/g, '/').replace(/\.astro$/, '').replace(/\.(ts|js|mjs)$/, '');
}

// ---------------------------------------------------------------- core
function convert(file) {
  const rel = relative(A, file).replace(/\\/g, '/');
  const src = readFileSync(file, 'utf8');
  const { ast, diagnostics } = parse(src);
  for (const d of diagnostics || []) if (d.severity === 'error' || d.severity === 1) err(rel, 'parse: ' + (d.text || d.message));
  // Edits: [start, end, replacement | () => replacement]. Applied outermost
  // first; an edit inside a range another edit replaces is dropped, unless the
  // outer edit renders that range itself (slot moves).
  const edits = [];
  const cut = (s, e, r = '') => edits.push([s, e, r]);
  const isPage = rel.startsWith('pages/');
  const namedSlots = new Set();
  const moved = new Set(); // elements carried into a named-slot prop

  function applyRange(s, e) {
    const inside = edits.filter(([a, b]) => a >= s && b <= e && !(a === s && b === e)).sort((x, y) => x[0] - y[0] || (y[1] - y[0]) - (x[1] - x[0]));
    let out = '', pos = s;
    for (const [a, b, r] of inside) {
      if (a < pos) continue; // nested inside an edit already applied
      out += src.slice(pos, a) + (typeof r === 'function' ? r() : r);
      pos = b;
    }
    return out + src.slice(pos, e);
  }

  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach((c) => visit(c));
    if (n.type === 'AstroComment') return cut(n.start, n.end);
    if (n.type === 'JSXElement' || n.type === 'JSXFragment') {
      const open = n.openingElement;
      const tag = open ? src.slice(open.name.start, open.name.end) : '';
      if (tag === 'style') return cut(n.start, n.end);
      if (tag === 'script') {
        const type = open.attributes.find((a) => a.name?.name === 'type')?.value?.value;
        if (type !== 'application/ld+json') { err(rel, '<script> in a component; move it to src/scripts'); return; }
      }
      if (tag === 'slot') {
        const nameAttr = open.attributes.find((a) => a.name?.name === 'name');
        if (!nameAttr) return cut(n.start, n.end, '{children}');
        const prop = camel(nameAttr.value.value);
        namedSlots.add(prop);
        return cut(n.start, n.end, `{${prop}}`);
      }
      if (tag === 'Fragment') {
        if (open.attributes.length) err(rel, '<Fragment> with attributes');
        cut(open.start, open.end, '<>');
        if (n.closingElement) cut(n.closingElement.start, n.closingElement.end, '</>');
      }
      if (tag === 'Content') {
        err(rel, '<Content /> must be the only child of an element');
        return;
      }
      const isComponent = /^[A-Z]/.test(tag) || tag.includes('.');
      // Rendered Markdown: the parent takes the HTML directly.
      const kids = (n.children || []).filter((c) => !(c.type === 'JSXText' && !src.slice(c.start, c.end).trim()));
      if (!isComponent && kids.length === 1 && kids[0].type === 'JSXElement' && src.slice(kids[0].openingElement.name.start, kids[0].openingElement.name.end) === 'Content') {
        if (kids[0].openingElement.attributes.length) err(rel, '<Content> with attributes');
        for (const a of open.attributes) attr(a, false, n);
        cut(n.children[0].start, n.children.at(-1).end);
        cut(open.name.end, open.name.end, ' dangerouslySetInnerHTML={{ __html: Content.html }}');
        return;
      }
      // Named slots on a component: the child moves into a prop of the same name.
      if (isComponent) {
        for (const c of n.children || []) {
          if (c.type !== 'JSXElement') continue;
          const s = c.openingElement.attributes.find((a) => a.name?.name === 'slot');
          if (!s) continue;
          if (s.value?.type !== 'Literal') { err(rel, 'dynamic slot name'); continue; }
          cut(s.start - 1, s.end);
          moved.add(c);
          visit(c);
          cut(c.start, c.end);
          cut(open.name.end, open.name.end, () => ` ${camel(s.value.value)}={${applyRange(c.start, c.end)}}`);
        }
      } else if (open && !moved.has(n)) {
        for (const a of open.attributes) if (a.name?.name === 'slot') err(rel, 'slot attribute outside a component');
      }
      if (open) for (const a of open.attributes) if (a.name?.name !== 'slot') attr(a, isComponent, n);
      return visit((n.children || []).filter((c) => !(isComponent && c.type === 'JSXElement' && c.openingElement.attributes.some((a) => a.name?.name === 'slot'))));
    }
    if (n.type === 'JSXText') {
      const t = src.slice(n.start, n.end);
      if (/[>}]/.test(t)) cut(n.start, n.end, t.replace(/>/g, "{'>'}").replace(/\}/g, "{'}'}"));
      return;
    }
    for (const k of Object.keys(n)) if (k !== 'start' && k !== 'end') visit(n[k]);
  };

  const attr = (a, isComponent, el) => {
    if (a.type === 'JSXSpreadAttribute') return visit(a.argument);
    const name = src.slice(a.name.start, a.name.end);
    const v = a.value;
    const vsrc = v ? src.slice(v.start, v.end) : null;
    const inner = v?.type === 'JSXExpressionContainer' ? src.slice(v.expression.start, v.expression.end) : null;
    if (v?.type === 'JSXExpressionContainer') visit(v.expression);
    if (name === 'class:list') return cut(a.start, a.end, `className={cx(${inner})}`);
    if (name === 'set:html') {
      if (isComponent) err(rel, 'set:html on a component');
      if (el.children?.some((c) => !(c.type === 'JSXText' && !src.slice(c.start, c.end).trim()))) err(rel, 'set:html element has children');
      if (el.children?.length) cut(el.children[0].start, el.children.at(-1).end);
      return cut(a.start, a.end, `dangerouslySetInnerHTML={{ __html: ${inner ?? vsrc} }}`);
    }
    if (name.startsWith('set:') || name.startsWith('is:') || name.startsWith('client:') || name === 'define:vars' || name.startsWith('transition:')) {
      return err(rel, `unsupported directive ${name}`);
    }
    if (name === 'style') {
      if (v?.type === 'Literal') return cut(a.start, a.end, `style={sx(${vsrc})}`);
      if (inner !== null) return cut(a.start, a.end, `style={sx(${inner})}`);
      if (v?.type === 'TemplateLiteral' || vsrc?.startsWith('`')) return cut(a.start, a.end, `style={sx(${vsrc})}`);
    }
    // Astro allows attr=`template`; JSX needs braces.
    if (vsrc?.startsWith('`')) cut(v.start, v.end, `{${vsrc}}`);
    const out = isComponent ? (name === 'class' ? 'className' : name) : domAttrName(name);
    // A bare data-* attribute is an empty string in HTML; React would print "true".
    if (!isComponent && !v && out.startsWith('data-')) cut(a.name.end, a.name.end, '=""');
    // React types these DOM attributes as numbers.
    if (!isComponent && v?.type === 'Literal' && /^(tabIndex|rows|cols|maxLength|minLength|colSpan|rowSpan|span|start)$/.test(out) && /^-?\d+$/.test(String(v.value))) cut(v.start, v.end, `{${v.value}}`);
    if (out !== name) cut(a.name.start, a.name.end, out);
  };

  visit(ast.body);

  // ---- frontmatter
  const fm = ast.frontmatter;
  const imports = new Set();
  let props = null, propsType = '', body = [], staticPaths = null; const types = [];
  const mapDynamic = (t) => t.replace(/import\(\s*'(\.[^']+)'\s*\)/g, (_, s) => `import('${mapImport(s, file)}')`);
  if (fm?.program) {
    for (const st of fm.program.body) {
      const text = src.slice(st.start, st.end);
      if (st.type === 'ImportDeclaration') {
        const to = mapImport(st.source.value, file);
        if (to === undefined) { err(rel, `unsupported import ${st.source.value}`); continue; }
        if (to === null) continue;
        imports.add(src.slice(st.start, st.source.start) + `'${to}';`);
        continue;
      }
      const decl = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
      if (decl?.type === 'TSInterfaceDeclaration' && decl.id.name === 'Props') { propsType = text.replace(/^export\s+/, '').replace(/\bclass(\??):/g, 'className$1:'); continue; }
      // Other type declarations stay at module level, where Props can see them.
      if (/^TS(Interface|TypeAlias)Declaration$/.test(decl?.type)) { types.push(text); continue; }
      if (st.type === 'ExportNamedDeclaration' && st.declaration?.id?.name === 'getStaticPaths') { staticPaths = mapDynamic(text.replace(/^export\s+/, '')); continue; }
      if (st.type === 'VariableDeclaration' && st.declarations.length === 1 && /^Astro\.props(\s+as\s+[\s\S]+)?$/.test(src.slice(st.declarations[0].init?.start, st.declarations[0].init?.end))) {
        props = src.slice(st.declarations[0].id.start, st.declarations[0].id.end).replace(/\bclass\s*:/g, 'className:');
        const cast = src.slice(st.declarations[0].init.start, st.declarations[0].init.end).match(/^Astro\.props\s+as\s+([\s\S]+)$/);
        if (cast) propsType = `type Props = ${cast[1]};`;
        continue;
      }
      body.push(mapDynamic(text));
    }
  }
  const env = (t) => t.replace(/import\.meta\.env\.SITE\b/g, `(process.env.NEXT_PUBLIC_SITE_URL || '${SITE}')`).replace(/import\.meta\.env\.PUBLIC_/g, 'process.env.NEXT_PUBLIC_');
  let code = env(body.join('\n'));
  if (ASTRO_API.test(code) || /import\.meta/.test(code)) err(rel, 'Astro.* or import.meta used in frontmatter code');

  // apply body edits
  const off = fm ? fm.end : 0;
  let markup = applyRange(off, src.length);
  markup = markup.replace(/^\s*---\s*/, '').trim();
  if (ASTRO_API.test(markup)) err(rel, 'Astro.* used in markup');
  markup = markup.replace(/import\.meta\.env\.PUBLIC_/g, 'process.env.NEXT_PUBLIC_');

  const usesChildren = /\{children\}/.test(markup);
  const head = [];
  if (markup.includes('cx(')) head.push("import { cx } from '@/lib/cx';");
  if (markup.includes('sx(')) head.push("import { sx } from '@/lib/sx';");
  head.push(...imports);
  const isAsync = /\bawait\b/.test(code);

  let name = basename(file, '.astro').replace(/(^|[-_\[\]])(\w)/g, (_, __, c) => c.toUpperCase()).replace(/\W/g, '');
  if (/^\d/.test(name)) name = 'Page' + name;
  // Pages get a suffix so they never collide with an imported type or component.
  if (isPage) name = (name === 'Index' ? 'Home' : name) + 'Page';
  const extra = [...(usesChildren ? ['children'] : []), ...namedSlots];
  const extraType = extra.map((k) => `${k}?: React.ReactNode`).join('; ');
  let sig = props ?? (extra.length ? `{ ${extra.join(', ')} }` : '');
  if (props) for (const k of extra) if (!new RegExp(`\\b${k}\\b`).test(sig)) sig = sig.replace(/\}\s*$/, `, ${k} }`);
  let ann = propsType ? ': Props' : '';
  if (extra.length) ann = propsType ? `: Props & { ${extraType} }` : `: { ${extraType} }`;

  let pre = '';
  if (staticPaths) {
    // getStaticPaths returns [{ params: { x }, props }]. Next asks for the
    // params up front and the page looks its props up again by param.
    const param = rel.match(/\[(\w+)\]/)?.[1];
    if (!param) err(rel, 'getStaticPaths outside a [param] route');
    pre = `${env(staticPaths)}\n\nexport const dynamicParams = false;\n\nexport async function generateStaticParams() {\n  return (await getStaticPaths()).map((p) => p.params);\n}\n`;
    sig = `{ params }: { params: Promise<{ ${param}: string }> }`;
    ann = '';
    code = `const { ${param}: requested } = await params;\nconst ${props ?? '_'} = ((await getStaticPaths()).find((p) => p.params.${param} === requested)!.props) as ${propsType ? 'Props' : 'any'};\n${code}`;
  }
  const fn = `export default ${isAsync || staticPaths ? 'async ' : ''}function ${name}(${sig}${ann}) {\n` +
    (code.trim() ? code.split('\n').map((l) => (l.trim() ? '  ' + l : '')).join('\n') + '\n\n' : '') +
    `  return (\n    <>\n${markup.split('\n').map((l) => (l.trim() ? '      ' + l : '')).join('\n')}\n    </>\n  );\n}\n`;

  const banner = `// GENERATED from src/${rel} by tools/astro-to-next.mjs. Edit the Astro file, then regenerate.\n`;
  const out = [banner + head.join('\n'), types.join('\n'), propsType, pre, fn].filter(Boolean).join('\n\n');

  let dest;
  if (isPage) {
    let route = rel.replace(/^pages\//, '').replace(/\.astro$/, '');
    if (route === '404') return { rel, dest: join(N, 'app', 'not-found.tsx'), out: out.replace(/export default (async )?function \w+/, 'export default $1function NotFound') };
    route = route === 'index' ? '' : route.replace(/\/index$/, '');
    dest = join(N, 'app', route, 'page.tsx');
  } else dest = join(N, rel.replace(/\.astro$/, '.tsx'));
  return { rel, dest, out };
}

// Demo copy names its stack ("Astro template", "built with Astro"). The Next
// build names Next.js in the same places: titles, descriptions, alt text, JSON-LD.
const nextStack = (s) => s
  .replace(/\b([Aa])n Astro (?=(?:website )?template)/g, '$1 Next.js ')
  .replace(/\bAstro (?=(?:website )?[Tt]emplate)/g, 'Next.js ')
  .replace(/\bbuilt with Astro\b/g, 'built with Next.js');
const nextStackTree = (dir) => {
  for (const f of walkDir(dir)) {
    if (!/\.(json|md|mdx)$/.test(f)) continue;
    const s = readFileSync(f, 'utf8');
    const t = nextStack(s);
    if (t !== s) writeFileSync(f, t);
  }
};

// ---------------------------------------------------------------- run
const files = walkDir(A).filter((f) => f.endsWith('.astro') && !HAND.has(relative(A, f).replace(/\\/g, '/')));
for (const f of walkDir(join(A, 'pages'))) if (!f.endsWith('.astro') && !/(sitemap\.xml|robots\.txt)\.ts$/.test(f)) err(relative(A, f), 'endpoint without a Next counterpart');
for (const d of ['components', 'app', 'lib', 'scripts']) {
  // Wipe generated output (never the hand-written files).
  const dir = join(N, d);
  if (!existsSync(dir)) continue;
  for (const f of walkDir(dir)) if (readFileSync(f, 'utf8').startsWith('// GENERATED')) rmSync(f);
}
const results = files.map(convert);
for (const { dest, out } of results) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, nextStack(out)); }

// Content and behaviour are shared verbatim.
const copyTree = (from, to, filter = () => true) => {
  for (const f of walkDir(from)) {
    if (!filter(f)) continue;
    const d = join(to, relative(from, f));
    mkdirSync(dirname(d), { recursive: true });
    copyFileSync(f, d);
  }
};
const banner = (from) => `// GENERATED from src/${from} by tools/astro-to-next.mjs. Edit the Astro file, then regenerate.\n`;
for (const f of walkDir(join(A, 'scripts'))) {
  const r = relative(A, f);
  const d = join(N, r);
  mkdirSync(dirname(d), { recursive: true });
  writeFileSync(d, banner(r) + readFileSync(f, 'utf8'));
}
rmSync(join(N, 'content'), { recursive: true, force: true });
copyTree(join(A, 'content'), join(N, 'content'));
nextStackTree(join(N, 'content'));
// Plain TS helpers: the only Astro-specific line is the content import, which
// points at the hand-written Next counterpart with the same API.
for (const f of readdirSync(join(A, 'lib'))) {
  let s = readFileSync(join(A, 'lib', f), 'utf8').replace(/import\.meta\.env\.PUBLIC_/g, 'process.env.NEXT_PUBLIC_');
  s = s.replace(/from 'astro:content';/g, "from '@/lib/collections';");
  if (/astro:|import\.meta/.test(s) || ASTRO_API.test(s)) err(`lib/${f}`, 'Astro-only API left after conversion');
  writeFileSync(join(N, 'lib', f), banner(`lib/${f}`) + s);
}

// public/ is shared verbatim, except robots.txt, which is app/robots.ts in Next.
rmSync(join(ROOT, 'next', 'public'), { recursive: true, force: true });
copyTree(join(ROOT, 'public'), join(ROOT, 'next', 'public'), (f) => !/(^|\/)(robots\.txt|\.DS_Store)$/.test(relative(join(ROOT, 'public'), f)));

// The Next folder's README is the buyer doc.
copyFileSync(join(ROOT, 'buyer-docs', 'NEXT_README.md'), join(ROOT, 'next', 'README.md'));

console.log(`${results.length} files -> next/src`);
if (errors.length) { console.error('\nFAILED:\n  ' + errors.join('\n  ')); process.exit(1); }
