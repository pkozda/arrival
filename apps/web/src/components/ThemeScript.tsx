export function ThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem('arrivalos-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;return;}if(window.matchMedia('(prefers-color-scheme: light)').matches){document.documentElement.dataset.theme='light';}}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
