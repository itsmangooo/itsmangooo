import { projects } from './config.js';
import { addDays } from './github.js';

export const palettes = {
  dark: { bg: '#191c1a', panel: '#202421', line: '#3a413a', text: '#eeeae0', dim: '#aeb6a9',
    accent: '#c7ad7d', heat: ['#292f29', '#465442', '#687e60', '#92a485', '#c4d0b8'] },
  light: { bg: '#f4f2eb', panel: '#ebece3', line: '#ccd1c4', text: '#272c26', dim: '#5e6759',
    accent: '#795e2f', heat: ['#e1e5d9', '#bdc9ad', '#8fa27c', '#627c4f', '#3f592f'] },
};
export const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[char]));
const number = value => value.toLocaleString('en-US');
const dateLabel = value => new Date(value + 'T00:00:00Z').toLocaleDateString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
});
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const line = (x1, y1, x2, y2, color, extra = '') => `<path d="M${x1} ${y1}H${x2}" ${y1 !== y2 ? `transform="rotate(${Math.atan2(y2-y1,x2-x1)*180/Math.PI} ${x1} ${y1})"` : ''} stroke="${color}" ${extra}/>`;
const text = (x, y, value, size, color, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${escapeXml(value)}</text>`;
const mono = 'font-family="ui-monospace,SFMono-Regular,Consolas,Liberation Mono,monospace"';
const titleText = (p, label, sub) => text(22, 29, label, 15, p.text, 'font-weight="600"')
  + text(22, 49, sub, 11, p.dim, mono);

function svg(width, height, title, description, p, contents) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(title)}</title>
<desc id="desc">${escapeXml(description)}</desc>
<g font-family="Arial,Helvetica,sans-serif">${rect(.5, .5, width-1, height-1, p.bg, `rx="8" stroke="${p.line}"`)}${contents}</g>
</svg>\n`;
}

export function header(p) {
  const fruit = ['0000001100','0000011000','0001110000','0011111000','0111111100',
    '0111111100','1111111100','1111111000','0111110000','0011100000'];
  let pixels = '';
  fruit.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell === '1') pixels += rect(652 + x*7, 58 + y*7, 6, 6, y < 2 ? p.dim : p.accent);
  }));
  return svg(800, 213, 'mango — itsmangooo', 'A personal workbench for small tools, connected systems and a few games.', p,
    text(30, 31, 'itsmangooo / personal workbench', 12, p.dim, mono)
    + text(770, 31, 'INDEX 00', 11, p.dim, `${mono} text-anchor="end"`)
    + text(25, 137, 'mango', 108, p.text, 'font-weight="700" letter-spacing="-7"')
    + `<circle cx="362" cy="128" r="7" fill="${p.accent}"/>`
    + pixels + line(30, 159, 770, 159, p.line)
    + text(30, 190, 'small tools. connected systems. a few games.', 18, p.dim));
}

function icon(kind, p) {
  const start = `<g transform="translate(314 28)" fill="none" stroke="${p.dim}" stroke-width="1.4" stroke-linejoin="round">`;
  const paths = {
    cards: '<rect x="1" y="3" width="26" height="36" rx="3" transform="rotate(-12 14 21)"/><rect x="16" y="3" width="26" height="36" rx="3"/><path d="m22 21 7-7 7 7-7 7Z"/>',
    rack: '<rect x="0" y="2" width="44" height="12" rx="2"/><rect x="0" y="18" width="44" height="12" rx="2"/><path d="M7 8h2m5 0h21M7 24h2m5 0h21M22 30v9M9 39h26"/>',
    phone: '<rect x="10" y="0" width="25" height="42" rx="4"/><path d="M17 6h11M17 35h11M16 15h5v4h-5zm8 0h5v4h-5zm-8 8h13"/>',
    terrain: '<path d="m0 33 13-18 9 9 10-21 14 30M0 40h46M14 33l6-8m11-13 5 6"/><path d="m0 6 9 3-9 3m9-3h10"/>',
  };
  return start + paths[kind] + '</g>';
}

export function projectCard(project, repo, p) {
  if (!repo) throw new Error(`Featured public repository missing: ${project.repo}`);
  return svg(390, 200, project.name,
    `${project.lines.join(' ')} ${project.stack}. ${project.note}. Last pushed ${repo.pushedAt.slice(0,10)}. ${repo.url}`, p,
    text(22, 27, project.category, 10, p.accent, mono)
    + text(22, 61, project.name, project.name.length > 15 ? 21 : 28, p.text, 'font-weight="600" letter-spacing="-.6"')
    + icon(project.icon, p)
    + project.lines.map((value, i) => text(22, 94+i*20, value, 14, p.dim)).join('')
    + text(22, 145, project.stack, 11, p.text, mono)
    + line(22, 160, 368, 160, p.line)
    + text(22, 182, project.note, 11, p.dim)
    + text(368, 182, `PUSH ${repo.pushedAt.slice(0,10)}`, 9, p.dim, `${mono} text-anchor="end"`));
}

export function languageDistribution(repositories) {
  const counts = new Map();
  for (const repo of repositories) for (const [name, bytes] of Object.entries(repo.languages)) {
    counts.set(name, (counts.get(name) ?? 0) + bytes);
  }
  const total = [...counts.values()].reduce((sum, count) => sum+count, 0);
  const entries = [...counts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0], 'en'));
  const top = entries.slice(0, 3);
  if (entries.length > 3) top.push(['Other', entries.slice(3).reduce((sum, item) => sum+item[1], 0)]);
  return top.map(([name, bytes]) => ({ name, bytes, percent: total ? bytes / total * 100 : 0 }));
}

export function stats(data, p) {
  const total = data.days.reduce((sum, day) => sum+day.total, 0);
  const active = data.days.filter(day => day.total > 0).length;
  const stars = data.repositories.reduce((sum, repo) => sum+repo.stars, 0);
  const languages = languageDistribution(data.repositories);
  return svg(390, 269, 'Public notebook', `${number(total)} public contributions over 365 days, ${active} active days, ${data.repositories.length} public source repositories, ${stars} stars received. Languages are measured by GitHub code bytes, not coding time.`, p,
    titleText(p, 'Public notebook', `365 days / through ${data.range.end}`)
    + text(20, 104, number(total), 45, p.text, 'font-weight="600" letter-spacing="-2"')
    + text(22, 126, 'public contributions', 12, p.dim)
    + text(244, 83, `${active} active days`, 12, p.dim)
    + text(244, 105, `${data.repositories.length} source repos`, 12, p.dim)
    + text(244, 127, `${stars} stars received`, 12, p.dim)
    + line(22, 143, 368, 143, p.line)
    + text(22, 166, 'LANGUAGES / PUBLIC CODE BYTES', 10, p.dim, mono)
    + languages.map((item, i) => {
      const y = 188+i*19;
      return text(22, y, item.name, 11, p.text)
        + rect(121, y-7, 174, 4, p.panel, 'rx="2"')
        + rect(121, y-7, Math.max(.5, 174*item.percent/100).toFixed(2), 4, p.heat[4-i], 'rx="2"')
        + text(368, y, `${item.percent.toFixed(1)}%`, 11, p.dim, `${mono} text-anchor="end"`);
    }).join(''));
}

export function calendar(data, p) {
  const total = data.days.reduce((sum, day) => sum+day.total, 0);
  const peak = Math.max(1, ...data.days.map(day => day.total));
  const startWeekday = new Date(data.range.start + 'T00:00:00Z').getUTCDay();
  let contents = titleText(p, 'A year in small squares', `${data.range.start} — ${data.range.end} / public contributions`);
  const months = new Set();
  const counts = new Map(data.days.map(day => [day.date, day.total]));
  const gridStart = addDays(data.range.start, -startWeekday);
  for (let index = 0; index < 371; index++) {
    const date = addDays(gridStart, index);
    const week = Math.floor(index/7), weekday = index%7;
    if (date > data.range.end) break;
    const count = counts.get(date);
    const x = 43+week*14, y = 80+weekday*13;
    if (count === undefined) continue;
    const level = count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(Math.sqrt(count / peak)*4)));
    contents += `<g><title>${date}: ${count} public contributions</title>${rect(x,y,10,10,p.heat[level],'rx="1.5"')}</g>`;
    const month = date.slice(0,7);
    if (!months.has(month) && (index === startWeekday || date.endsWith('-01'))) {
      months.add(month);
      // Avoid colliding labels when the range starts at the end of a month.
      if (index === startWeekday || week >= 3) contents += text(x, 69,
        new Date(date+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',timeZone:'UTC'}), 10, p.dim, mono);
    }
  }
  contents += text(20, 100, 'M', 9, p.dim, mono) + text(20, 126, 'W', 9, p.dim, mono) + text(20, 152, 'F', 9, p.dim, mono)
    + text(22, 195, `${number(total)} public contributions`, 12, p.text)
    + text(572, 195, 'less', 10, p.dim, mono)
    + p.heat.map((color, i) => rect(611+i*15,185,10,10,color,'rx="1.5"')).join('')
    + text(698, 195, 'more', 10, p.dim, mono);
  return svg(800, 213, 'Public contribution calendar', `${number(total)} public contributions over 365 days. Each square is one day. Includes public commits, opened issues, pull requests, reviews and repository creation.`, p, contents);
}

export function calendarCompact(data,p) {
  const total=data.days.reduce((sum,day)=>sum+day.total,0);
  const peak=Math.max(1,...data.days.map(day=>day.total));
  const startWeekday=new Date(data.range.start+'T00:00:00Z').getUTCDay();
  let contents=titleText(p,'A year in small squares','365 days / public contributions');
  const firstEnd=addDays(data.range.start,181-startWeekday);
  contents+=text(22,73,`${data.range.start} — ${firstEnd}`,10,p.dim,mono)
    +text(22,190,`${addDays(firstEnd,1)} — ${data.range.end}`,10,p.dim,mono);
  for(const [index,day] of data.days.entries()) {
    const offset=index+startWeekday;
    const week=Math.floor(offset/7), weekday=offset%7;
    const half=week>=26?1:0;
    const x=43+(week-(half?26:0))*12;
    const y=85+half*117+weekday*12;
    const level=day.total===0?0:Math.min(4,Math.max(1,Math.ceil(Math.sqrt(day.total/peak)*4)));
    contents+=`<g><title>${day.date}: ${day.total} public contributions</title>${rect(x,y,9,9,p.heat[level],'rx="1"')}</g>`;
  }
  for(const offset of [0,117]) contents+=text(22,105+offset,'M',9,p.dim,mono)
    +text(22,129+offset,'W',9,p.dim,mono)+text(22,153+offset,'F',9,p.dim,mono);
  contents+=line(22,289,368,289,p.line)+text(22,311,`${number(total)} public contributions`,12,p.text);
  return svg(390,327,'Public contribution calendar, compact',
    `${number(total)} public contributions over 365 days. Two chronological rows of weeks, with one square per day.`,p,contents);
}

export function weeklyTotals(days, end, count = 12) {
  const weekday = new Date(end+'T00:00:00Z').getUTCDay();
  const currentMonday = addDays(end, -((weekday+6)%7));
  const start = addDays(currentMonday, -7*(count-1));
  const values = Array.from({length: count}, (_,index) => ({start:addDays(start,index*7),total:0}));
  for (const day of days) {
    const index = Math.floor((Date.parse(day.date)-Date.parse(start))/604_800_000);
    if (index >= 0 && index < count && day.date <= end) values[index].total += day.total;
  }
  return values;
}

export function activity(data, p) {
  const weeks = weeklyTotals(data.days, data.range.end);
  const max = Math.max(1,...weeks.map(week => week.total));
  const recent = weeks.reduce((sum, week) => sum+week.total, 0);
  const commitCount = data.days.filter(day => day.date >= weeks[0].start).reduce((sum,day) => sum+day.commits,0);
  let bars = '';
  weeks.forEach((week, i) => {
    const x = 26+i*28, height = 97*week.total/max;
    bars += `<g><title>Week of ${week.start}: ${week.total} public contributions${i===11?' (current week, incomplete)':''}</title>`
      + rect(x, 72, 18, 102, p.panel, 'rx="2"')
      + (week.total ? rect(x, 174-height, 18, height, i===11?p.accent:p.heat[3], 'rx="2"') : '') + '</g>';
  });
  return svg(390, 269, 'The last twelve weeks', `${recent} public contributions, including ${commitCount} commits. Bars use a shared linear scale. Weeks start Monday; the final week is incomplete.`, p,
    titleText(p, 'The last twelve weeks', `${number(recent)} public contributions / ${number(commitCount)} commits`)
    + bars + text(26, 194, weeks[0].start, 10, p.dim, mono)
    + text(352, 194, 'THIS WEEK*', 10, p.dim, `${mono} text-anchor="end"`)
    + line(22, 210, 368, 210, p.line)
    + text(22, 233, `peak week: ${number(Math.max(...weeks.map(week=>week.total)))}`, 12, p.text)
    + text(22, 253, '* Monday start; current week is incomplete.', 10, p.dim));
}

export function windowWidget(data, p) {
  const recent = data.days.slice(-28);
  const lit = recent.filter(day=>day.total>0).length;
  let panes='';
  recent.forEach((day,i) => {
    const col = i%7, row=Math.floor(i/7);
    panes += `<g><title>${day.date}: ${day.total} public contributions</title>`
      + rect(27+col*13, 62+row*15, 9, 11, day.total?p.accent:p.heat[0], 'rx="1"') + '</g>';
  });
  return svg(390, 162, 'A little light on', `${lit} of the last 28 days had public contributions. Each lit window pane represents one active day. Decorative window, not live presence or time-of-day tracking.`, p,
    text(151, 35, 'A little light on.', 19, p.text, 'font-weight="600"')
    + `<path d="M18 45h105v83H18zm-5 88h116M70 45V28m-12 0h24" fill="none" stroke="${p.line}" stroke-width="2"/>`
    + panes
    + text(151, 64, `${lit} / 28 days at the workbench`, 12, p.dim)
    + text(151, 87, 'One lit pane per active day.', 12, p.dim)
    + text(151, 107, 'Public activity, quietly recorded.', 12, p.dim)
    + text(22, 149, `${data.capturedOn} / a window, not a status light`, 10, p.dim, mono));
}

export function badge(label, width, p) {
  return svg(width, 27, label, `Technology used in public projects: ${label}`, p,
    rect(9, 10, 5, 5, p.accent, 'rx="1"')+text(22,18,label,11,p.text,mono));
}

export function renderAssets(data) {
  const assets = new Map();
  for (const [theme,p] of Object.entries(palettes)) {
    assets.set(`header-${theme}.svg`, header(p));
    assets.set(`calendar-${theme}.svg`, calendar(data,p));
    assets.set(`calendar-mobile-${theme}.svg`, calendarCompact(data,p));
    assets.set(`stats-${theme}.svg`, stats(data,p));
    assets.set(`activity-${theme}.svg`, activity(data,p));
    assets.set(`window-${theme}.svg`, windowWidget(data,p));
    for (const project of projects) {
      assets.set(`${project.repo.toLowerCase()}-${theme}.svg`,projectCard(project,data.repositories.find(repo=>repo.name===project.repo),p));
    }
    for (const [label,width] of [['Go',54],['JavaScript',107],['C#',54],['Dart',72]]) {
      assets.set(`badge-${label.toLowerCase().replace('#','sharp')}-${theme}.svg`,badge(label,width,p));
    }
  }
  return assets;
}

function picture(asset, alt, width) {
  const compact=asset==='calendar'?`<source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="assets/calendar-mobile-dark.svg"><source media="(max-width: 600px) and (prefers-color-scheme: light)" srcset="assets/calendar-mobile-light.svg">`:'';
  return `<picture>${compact}<source media="(prefers-color-scheme: dark)" srcset="assets/${asset}-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/${asset}-light.svg"><img src="assets/${asset}-light.svg" alt="${escapeXml(alt)}" width="${width}"></picture>`;
}

export function renderReadme(data) {
  const total = data.days.reduce((sum,day)=>sum+day.total,0);
  return `${picture('header','mango — itsmangooo. Small tools, connected systems, a few games.',800)}

I’m mango. I build things I want to use: tools for a homelab, places to deploy them, and games to share with friends.

Most of that lands somewhere between Go services, browser interfaces, Android, and simulation. I like seeing how the pieces fit together.

${[['Go',54],['JavaScript',107],['C#',54],['Dart',72]].map(([label,width])=>picture(`badge-${label.toLowerCase().replace('#','sharp')}`,label,width)).join(' ')}

**Systems** · Go, PostgreSQL, Docker<br>**Interfaces** · JavaScript, React, Flutter<br>**Games** · Three.js, Socket.IO, Unity / C#

### On the workbench

${projects.map(project=>`<a href="https://github.com/${data.login}/${project.repo}">${picture(project.repo.toLowerCase(),`${project.name}: ${project.lines.join(' ')} ${project.stack}. ${project.note}.`,390)}</a>`).join(' ')}

[Silicon’s public documentation](https://itsmangooo.github.io/Silicon-Docs/) lives on its own shelf. FIRELINE is an ongoing prototype; its repository tracks the open milestones.

### Leaving a trace

${picture('calendar',`${number(total)} public contributions over 365 days, ${data.range.start} through ${data.range.end}. One square per day.`,800)}

${picture('stats','Public contribution totals, active days, source repositories, stars received, and languages by public code bytes.',390)} ${picture('activity','Public development activity over twelve Monday-based weeks. The current week is incomplete.',390)}

<sub>Public data only · refreshed ${dateLabel(data.capturedOn)} · [How these are counted](docs/WIDGETS.md) · [Refresh workflow](https://github.com/${data.login}/${data.login}/actions/workflows/refresh.yml)</sub>

${picture('window','A little light on: one lit window pane for each day with public activity over the last 28 days.',390)}

---

[Repositories](https://github.com/${data.login}?tab=repositories) · [Silicon docs](https://itsmangooo.github.io/Silicon-Docs/) · [Under the hood](docs/WIDGETS.md)

<sub>mango / ASCII: 6d 61 6e 67 6f</sub>
`;
}
