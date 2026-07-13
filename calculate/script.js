(function () {
	var state = { type: 'table', drape: true };
	var rolls = [{ len: 25, qty: 1 }];

	var els = {
		width: document.getElementById('width'),
		length: document.getElementById('length'),
		height: document.getElementById('height'),
		stripWidth: document.getElementById('stripWidth'),
		spusk: document.getElementById('spusk'),
		price: document.getElementById('price'),
		lengthField: document.getElementById('lengthField'),
		diagram: document.getElementById('diagram'),
		rollRows: document.getElementById('rollRows'),
		addRoll: document.getElementById('addRoll'),
		rollPlan: document.getElementById('rollPlan'),
		rStrips: document.getElementById('rStrips'),
		rStripLen: document.getElementById('rStripLen'),
		rTotalMeters: document.getElementById('rTotalMeters'),
		rCost: document.getElementById('rCost'),
		rFormula: document.getElementById('rFormula')
	};

	// Разбор числа с поддержкой запятой (мобильная клавиатура предлагает её).
	function pf(v) {
		return parseFloat(String(v == null ? '' : v).replace(',', '.'));
	}

	function num(el) {
		var v = pf(el.value);
		return isNaN(v) ? 0 : v;
	}

	function fmtM(x) {
		return (Math.round(x * 100) / 100).toString().replace('.', ',') + ' м';
	}

	function fmtEur(x) {
		return (Math.round(x * 100) / 100).toFixed(2).replace('.', ',') + ' €';
	}

	function calc() {
		var width = num(els.width);
		var length = num(els.length);
		var height = num(els.height);
		var stripWidth = num(els.stripWidth);
		var spusk = num(els.spusk);
		var mult = state.drape ? 2 : 1;
		var price = num(els.price);

		persist();

		if (stripWidth <= 0) {
			showEmpty('Укажите ширину полоски больше 0');
			return;
		}

		// Полоски и длина полоски.
		var strips, stripLen, formula;
		if (state.type === 'table') {
			// Драпировка вдоль короткой стороны: число полосок считаем по длинной стороне,
			// а длина полоски — по короткой стороне (+ 2 высоты и 2 спуска по торцам).
			var shortS = Math.min(width, length);
			var longS = Math.max(width, length);
			strips = Math.ceil(longS * mult / stripWidth);
			stripLen = shortS + 2 * height + 2 * spusk;
			formula = 'Полоски по длинной стороне (' + fmtNum(longS) + ' м): ceil(' +
				fmtNum(longS) + ' × ' + fmtNum(mult) + ' / ' + fmtNum(stripWidth) + ') = ' + strips +
				'. Длина полоски по короткой (' + fmtNum(shortS) + ' м): ' + fmtNum(shortS) + ' + 2×' + fmtNum(height) + ' + 2×' + fmtNum(spusk) + ' = ' + fmtNum(stripLen) + ' м.';
		} else {
			// Бэкдроп: драпировка по ширине, полоска = высота + 1 спуск.
			strips = Math.ceil(width * mult / stripWidth);
			stripLen = height + spusk;
			formula = 'Полоски: ceil(' + fmtNum(width) + ' × ' + fmtNum(mult) + ' / ' + fmtNum(stripWidth) + ') = ' + strips +
				'. Длина полоски: ' + fmtNum(height) + ' + ' + fmtNum(spusk) + ' = ' + fmtNum(stripLen) + ' м.';
		}
		if (!isFinite(strips) || strips < 0) strips = 0;

		var totalMeters = strips * stripLen;
		var cost = totalMeters * price;

		els.rStrips.textContent = strips + ' шт.';
		els.rStripLen.textContent = fmtM(stripLen);
		els.rTotalMeters.textContent = fmtM(totalMeters);
		els.rCost.textContent = fmtEur(cost);
		els.rFormula.textContent = formula;

		syncPresets();
		drawDiagram(width, length, height, spusk, strips);
		renderPlan(distribute(strips, stripLen));
	}

	// ---- Изометрическая схема ----
	var A = Math.PI / 6, COS = Math.cos(A), SIN = Math.sin(A);
	function proj(p) { return { x: (p[0] - p[1]) * COS, y: (p[0] + p[1]) * SIN - p[2] }; }

	function drawDiagram(W, L, H, spusk, strips) {
		var faces = [], labels = [], drapes = [], seams = [];

		if (state.type === 'table') {
			if (W <= 0 || L <= 0 || H <= 0) { els.diagram.innerHTML = ''; return; }
			// Полоски и спуск идут вдоль длинной стороны — кладём её по оси X.
			var lo = Math.max(W, L), sh = Math.min(W, L);
			W = lo; L = sh;
			faces.push({ pts: [[0,0,H],[W,0,H],[W,L,H],[0,L,H]], fill: 'rgba(0,0,0,0.10)' }); // верх
			faces.push({ pts: [[W,0,0],[W,L,0],[W,L,H],[W,0,H]], fill: 'rgba(0,0,0,0.05)' }); // правая
			faces.push({ pts: [[0,L,0],[W,L,0],[W,L,H],[0,L,H]], fill: 'rgba(0,0,0,0.16)' }); // левая (перед)
			labels.push({ a: [0,L,0], b: [W,L,0], text: fmtNum(W) + ' м' });
			labels.push({ a: [W,L,0], b: [W,0,0], text: fmtNum(L) + ' м' });
			labels.push({ a: [W,0,H], b: [W,0,0], text: fmtNum(H) + ' м' });
			if (spusk > 0) {
				drapes.push([[0,L,0],[W,L,0],[W,L,-spusk],[0,L,-spusk]]);
				labels.push({ a: [0,L,0], b: [0,L,-spusk], text: fmtNum(spusk) + ' м' });
			}
			// Швы между полосками: делим длинную сторону (X); линия по верху, торцу и спуску.
			for (var si = 1; si < strips; si++) {
				var sx = si * W / strips;
				var seg = [[sx,0,H],[sx,L,H],[sx,L,0]];
				if (spusk > 0) seg.push([sx,L,-spusk]);
				seams.push(seg);
			}
		} else {
			if (W <= 0 || H <= 0) { els.diagram.innerHTML = ''; return; }
			// Бэкдроп — вертикальное полотно (плоскость y=0).
			faces.push({ pts: [[0,0,0],[W,0,0],[W,0,H],[0,0,H]], fill: 'rgba(0,0,0,0.12)' });
			labels.push({ a: [0,0,0], b: [W,0,0], text: fmtNum(W) + ' м' });
			labels.push({ a: [W,0,H], b: [W,0,0], text: fmtNum(H) + ' м' });
			if (spusk > 0) {
				drapes.push([[0,0,0],[W,0,0],[W,0,-spusk],[0,0,-spusk]]);
				labels.push({ a: [0,0,0], b: [0,0,-spusk], text: fmtNum(spusk) + ' м' });
			}
			// Швы между полосками: делим ширину (X); линия по высоте и спуску.
			for (var bi = 1; bi < strips; bi++) {
				var bx = bi * W / strips;
				var bseg = [[bx,0,H],[bx,0,0]];
				if (spusk > 0) bseg.push([bx,0,-spusk]);
				seams.push(bseg);
			}
		}

		// Масштаб: подгоняем фигуру под целевой размер (шрифт/стрелки постоянны),
		// потом viewBox строим по фактическим границам всего — фигуры, стрелок и подписей,
		// чтобы ничего не обрезалось при вытянутых пропорциях.
		var spts = [];
		faces.forEach(function (f) { f.pts.forEach(function (p) { spts.push(proj(p)); }); });
		drapes.forEach(function (d) { d.forEach(function (p) { spts.push(proj(p)); }); });
		labels.forEach(function (l) { spts.push(proj(l.a)); spts.push(proj(l.b)); });
		var sxs = spts.map(function (p) { return p.x; }), sys = spts.map(function (p) { return p.y; });
		var spanX = (Math.max.apply(null, sxs) - Math.min.apply(null, sxs)) || 1;
		var spanY = (Math.max.apply(null, sys) - Math.min.apply(null, sys)) || 1;
		var s = Math.min(320 / spanX, 230 / spanY);

		function m(p) { var q = proj(p); return [q.x * s, q.y * s]; }

		var BX0 = Infinity, BY0 = Infinity, BX1 = -Infinity, BY1 = -Infinity;
		function ext(x, y) { if (x < BX0) BX0 = x; if (y < BY0) BY0 = y; if (x > BX1) BX1 = x; if (y > BY1) BY1 = y; }
		function ptsStr(arr) { return arr.map(function (p) { var c = m(p); ext(c[0], c[1]); return c[0].toFixed(1) + ',' + c[1].toFixed(1); }).join(' '); }

		// Центр фигуры — чтобы выносить подписи наружу к своим сторонам.
		var cx = 0, cy = 0, n = 0;
		faces.forEach(function (f) { f.pts.forEach(function (p) { var c = m(p); cx += c[0]; cy += c[1]; n++; }); });
		cx /= n; cy /= n;

		var inner = '';
		drapes.forEach(function (d) { inner += '<polygon points="' + ptsStr(d) + '" fill="rgba(0,0,0,0.08)"/>'; });
		faces.forEach(function (f) { inner += '<polygon points="' + ptsStr(f.pts) + '" fill="' + f.fill + '"/>'; });
		// Швы между полосками — пунктирной линией, без подписей.
		seams.forEach(function (sg) { inner += '<polyline points="' + ptsStr(sg) + '" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="0.8" stroke-dasharray="3 2.5"/>'; });

		// Размерные линии со стрелками (как на чертежах): линия параллельна стороне,
		// вынесена наружу, со стрелками на концах; рядом только значение.
		var DIM = 20;
		labels.forEach(function (l) {
			var A = m(l.a), B = m(l.b);
			ext(A[0], A[1]); ext(B[0], B[1]);
			var ex = B[0] - A[0], ey = B[1] - A[1];
			var eln = Math.sqrt(ex * ex + ey * ey) || 1;
			var px = -ey / eln, py = ex / eln;
			var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
			if (px * (mx - cx) + py * (my - cy) < 0) { px = -px; py = -py; }

			var A2 = [A[0] + px * DIM, A[1] + py * DIM];
			var B2 = [B[0] + px * DIM, B[1] + py * DIM];
			ext(A2[0], A2[1]); ext(B2[0], B2[1]);

			inner += '<line x1="' + A[0].toFixed(1) + '" y1="' + A[1].toFixed(1) + '" x2="' + A2[0].toFixed(1) + '" y2="' + A2[1].toFixed(1) + '" stroke="#bbb" stroke-width="0.8"/>';
			inner += '<line x1="' + B[0].toFixed(1) + '" y1="' + B[1].toFixed(1) + '" x2="' + B2[0].toFixed(1) + '" y2="' + B2[1].toFixed(1) + '" stroke="#bbb" stroke-width="0.8"/>';
			inner += '<line x1="' + A2[0].toFixed(1) + '" y1="' + A2[1].toFixed(1) + '" x2="' + B2[0].toFixed(1) + '" y2="' + B2[1].toFixed(1) +
				'" stroke="#444" stroke-width="1" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)"/>';

			var tx = (A2[0] + B2[0]) / 2 + px * 11, ty = (A2[1] + B2[1]) / 2 + py * 11;
			var anchor = px > 0.25 ? 'start' : px < -0.25 ? 'end' : 'middle';
			// учитываем габариты текста в границах, чтобы не обрезалось
			var tw = l.text.length * 7, x0 = anchor === 'start' ? tx : (anchor === 'end' ? tx - tw : tx - tw / 2);
			ext(x0, ty - 8); ext(x0 + tw, ty + 8);
			inner += '<text x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" font-size="12" text-anchor="' + anchor +
				'" dominant-baseline="middle" fill="#333" stroke="#EDEDED" stroke-width="3.5" paint-order="stroke" style="stroke-linejoin:round">' + l.text + '</text>';
		});

		var M = 8;
		var vb = [(BX0 - M).toFixed(1), (BY0 - M).toFixed(1), (BX1 - BX0 + 2 * M).toFixed(1), (BY1 - BY0 + 2 * M).toFixed(1)].join(' ');
		var svg = '<svg viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg">' +
			'<defs><marker id="dimArrow" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto-start-reverse" markerUnits="userSpaceOnUse">' +
			'<path d="M0,0 L6.5,3 L0,6 Z" fill="#444"/></marker></defs>' + inner + '</svg>';
		els.diagram.innerHTML = svg;
	}

	function syncPresets() {
		presetMap.forEach(function (m) {
			var val = pf(m[1].value);
			Array.prototype.forEach.call(document.getElementById(m[0]).querySelectorAll('button'), function (b) {
				var bv = pf(b.getAttribute('data-val'));
				b.classList.toggle('active', Math.abs(bv - val) < 1e-9);
			});
		});
	}

	function fmtNum(x) {
		return (Math.round(x * 1000) / 1000).toString().replace('.', ',');
	}

	// ---- Рулоны ----
	function renderRolls() {
		els.rollRows.innerHTML = '';
		rolls.forEach(function (r, i) {
			var row = document.createElement('div');
			row.className = 'roll-row';
			row.innerHTML =
				'<div class="input-wrap"><input type="text" class="roll-len" inputmode="decimal"><span class="input-unit">м</span></div>' +
				'<span class="roll-x">×</span>' +
				'<div class="input-wrap"><input type="text" class="roll-qty" inputmode="numeric"><span class="input-unit">шт</span></div>' +
				'<button type="button" class="roll-del" title="удалить">×</button>';
			var lenI = row.querySelector('.roll-len');
			var qtyI = row.querySelector('.roll-qty');
			lenI.value = r.len;
			qtyI.value = r.qty;
			lenI.addEventListener('input', function () { rolls[i].len = pf(lenI.value) || 0; calc(); });
			qtyI.addEventListener('input', function () { rolls[i].qty = Math.max(0, parseInt(qtyI.value, 10) || 0); calc(); });
			row.querySelector('.roll-del').addEventListener('click', function () {
				rolls.splice(i, 1);
				if (rolls.length === 0) rolls.push({ len: 25, qty: 1 });
				renderRolls();
				calc();
			});
			els.rollRows.appendChild(row);
		});
	}

	// Раскрой: N одинаковых полосок длиной L по имеющимся рулонам.
	// Цель: минимум задействованных рулонов → минимум обрезков → самый длинный пригодный остаток.
	function distribute(N, L) {
		var res = { need: N, L: L, used: [], reusable: 0, scrap: 0, shortStrips: 0, totalCap: 0 };
		if (N <= 0 || L <= 0) return res;

		var units = [];
		rolls.forEach(function (r) {
			var cap = Math.floor((r.len + 1e-9) / L);
			var mod = r.len - cap * L; // обрезок, если рулон дорезать полностью
			for (var i = 0; i < r.qty; i++) if (cap > 0) units.push({ len: r.len, cap: cap, mod: mod });
		});
		// Сначала самые ёмкие (меньше рулонов), при равной ёмкости — с наименьшим обрезком
		// (рулон, который делится нацело, выгоднее длинного с остатком), затем короче по длине.
		units.sort(function (a, b) { return b.cap - a.cap || a.mod - b.mod || a.len - b.len; });
		res.totalCap = units.reduce(function (s, u) { return s + u.cap; }, 0);

		if (res.totalCap < N) res.shortStrips = N - res.totalCap;

		// Берём самые ёмкие рулоны, пока не покроем N (минимум рулонов).
		var chosen = [], acc = 0;
		for (var i = 0; i < units.length && acc < N; i++) { chosen.push(units[i]); acc += units[i].cap; }
		var D = Math.max(0, acc - N); // избыток ёмкости — оседает как длинный остаток

		// Рулон-остаток: с наибольшим (len mod L) → самый длинный пригодный остаток и минимум обрезков.
		var remIdx = -1, bestMod = -1;
		chosen.forEach(function (u, i) {
			var mod = u.len - u.cap * L;
			if (mod > bestMod + 1e-9) { bestMod = mod; remIdx = i; }
		});

		chosen.forEach(function (u, i) {
			var cut, leftover, reusable;
			if (i === remIdx && res.totalCap >= N) {
				cut = u.cap - D;
				leftover = u.len - cut * L;
				reusable = leftover >= L - 1e-9;
			} else {
				cut = u.cap;
				leftover = u.len - cut * L;
				reusable = false;
			}
			if (cut < 0) cut = 0;
			res.used.push({ len: u.len, cut: cut, leftover: leftover, reusable: reusable });
			if (reusable) res.reusable += leftover; else res.scrap += leftover;
		});

		return res;
	}

	function renderPlan(res) {
		if (res.need <= 0 || res.L <= 0) { els.rollPlan.innerHTML = ''; return; }

		var placed = res.need - res.shortStrips;
		var h = '<div class="plan-divider"></div>';

		if (res.used.length === 0) {
			h += '<div class="muted">Ни один рулон не вмещает полоску длиной ' + fmtM(res.L) + '. Добавьте рулоны подлиннее.</div>';
			els.rollPlan.innerHTML = h;
			return;
		}

		// Группируем одинаковые (длина + рез + пригодность) для компактности.
		var order = [], groups = {};
		res.used.forEach(function (u) {
			var key = u.len + '|' + u.cut + '|' + u.reusable;
			if (!groups[key]) { groups[key] = { len: u.len, cut: u.cut, leftover: u.leftover, reusable: u.reusable, n: 0 }; order.push(key); }
			groups[key].n++;
		});
		h += '<div class="plan-list">';
		order.forEach(function (k) {
			var g = groups[k];
			var cap = 'Рулон ' + fmtM(g.len) + (g.n > 1 ? ' ×' + g.n : '');
			var left = g.reusable ? 'Остаток ' + fmtM(g.leftover)
				: (g.leftover > 1e-6 ? 'Обрезок ' + fmtM(g.leftover) : 'Без остатка');
			h += '<div class="roll-card">' +
				'<img class="roll-card-icon" src="roll.png" alt="Рулон">' +
				'<span class="roll-card-cap">' + cap + '</span>' +
				'<span class="roll-card-strips">' + g.cut + ' пол.</span>' +
				'<span class="roll-card-left">' + left + '</span>' +
				'</div>';
		});
		h += '</div>';

		if (res.shortStrips > 0) {
			h += '<div class="muted">Рулонов хватает только на ' + placed + ' из ' + res.need + ' полосок — не хватает ' + res.shortStrips + '. Добавьте рулоны.</div>';
		}
		els.rollPlan.innerHTML = h;
	}

	function showEmpty(msg) {
		els.rStrips.textContent = '—';
		els.rStripLen.textContent = '—';
		els.rTotalMeters.textContent = '—';
		els.rCost.textContent = '—';
		els.rFormula.textContent = msg || '';
		els.rollPlan.innerHTML = '';
	}

	// ---- Состояние: сбор и применение ----
	function getState() {
		return {
			t: state.type,
			d: state.drape ? 1 : 0,
			w: els.width.value,
			l: els.length.value,
			h: els.height.value,
			s: els.spusk.value,
			sw: els.stripWidth.value,
			p: els.price.value,
			r: rolls.map(function (x) { return [x.len, x.qty]; })
		};
	}

	function applyState(o) {
		if (!o) return;
		if (o.t === 'table' || o.t === 'backdrop') state.type = o.t;
		state.drape = !(o.d === 0 || o.d === '0');
		if ('w' in o) els.width.value = o.w == null ? '' : o.w;
		if ('l' in o) els.length.value = o.l == null ? '' : o.l;
		if ('h' in o) els.height.value = o.h == null ? '' : o.h;
		if ('s' in o) els.spusk.value = o.s == null ? '' : o.s;
		if ('sw' in o) els.stripWidth.value = o.sw == null ? '' : o.sw;
		if ('p' in o) els.price.value = o.p == null ? '' : o.p;
		if (Array.isArray(o.r) && o.r.length) {
			rolls = o.r.map(function (a) { return { len: pf(a[0]) || 0, qty: Math.max(0, parseInt(a[1], 10) || 0) }; });
		}
		renderRolls();
		syncToggles();
	}

	function syncToggles() {
		Array.prototype.forEach.call(document.querySelectorAll('#typeToggle button'), function (b) {
			b.classList.toggle('active', b.getAttribute('data-type') === state.type);
		});
		els.lengthField.classList.toggle('hidden', state.type === 'backdrop');
		Array.prototype.forEach.call(document.querySelectorAll('#drapeToggle button'), function (b) {
			b.classList.toggle('active', (b.getAttribute('data-drape') === '1') === state.drape);
		});
	}

	// ---- Хранилище (localStorage) ----
	var LS_STATE = 'chora-calc-state';

	function persist() {
		try { localStorage.setItem(LS_STATE, JSON.stringify(getState())); } catch (e) {}
	}
	function loadPersisted() {
		try { var s = localStorage.getItem(LS_STATE); return s ? JSON.parse(s) : null; } catch (e) { return null; }
	}

	// Тип объекта
	document.getElementById('typeToggle').addEventListener('click', function (e) {
		var btn = e.target.closest('button');
		if (!btn) return;
		state.type = btn.getAttribute('data-type');
		Array.prototype.forEach.call(this.querySelectorAll('button'), function (b) {
			b.classList.toggle('active', b === btn);
		});
		els.lengthField.classList.toggle('hidden', state.type === 'backdrop');
		calc();
	});

	// Пресеты
	var presetMap = [
		['stripPresets', els.stripWidth],
		['pricePresets', els.price]
	];
	presetMap.forEach(function (m) {
		document.getElementById(m[0]).addEventListener('click', function (e) {
			var btn = e.target.closest('button');
			if (!btn) return;
			m[1].value = btn.getAttribute('data-val');
			calc();
		});
	});

	// Добавить вариант рулона
	els.addRoll.addEventListener('click', function () {
		rolls.push({ len: 25, qty: 1 });
		renderRolls();
		calc();
	});

	// Драпировка (переключатель): есть → множитель 2, нет → 1.
	document.getElementById('drapeToggle').addEventListener('click', function (e) {
		var btn = e.target.closest('button');
		if (!btn) return;
		state.drape = btn.getAttribute('data-drape') === '1';
		Array.prototype.forEach.call(this.querySelectorAll('button'), function (b) {
			b.classList.toggle('active', b === btn);
		});
		calc();
	});

	// Пересчёт при любом вводе
	['width', 'length', 'height', 'stripWidth', 'spusk', 'price'].forEach(function (k) {
		els[k].addEventListener('input', calc);
	});

	// ---- Инициализация: запомненные значения > значения по умолчанию ----
	var saved = loadPersisted();
	if (saved) applyState(saved);
	else renderRolls();
	syncToggles();
	calc();
})();
