function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('themeToggle');

    body.classList.toggle('light-mode');

    if (body.classList.contains('light-mode')) {
        btn.innerHTML = '🌙 Modo Oscuro';
        localStorage.setItem('theme', 'light');
    } else {
        btn.innerHTML = '☀️ Modo Claro';
        localStorage.setItem('theme', 'dark');
    }
}

const crop_data = [
    { level: 0, cost: 0, prod: 2, maxRes: 0, maxCrop: 0 },
    { level: 1, cost: 250, prod: 14, maxRes: 90, maxCrop: 20 },
    { level: 2, cost: 415, prod: 26, maxRes: 150, maxCrop: 35 },
    { level: 3, cost: 695, prod: 42, maxRes: 250, maxCrop: 55 },
    { level: 4, cost: 1165, prod: 62, maxRes: 420, maxCrop: 95 },
    { level: 5, cost: 1945, prod: 92, maxRes: 700, maxCrop: 155 },
    { level: 6, cost: 3250, prod: 140, maxRes: 1170, maxCrop: 260 },
    { level: 7, cost: 5425, prod: 196, maxRes: 1950, maxCrop: 435 },
    { level: 8, cost: 9055, prod: 280, maxRes: 3260, maxCrop: 725 },
    { level: 9, cost: 15125, prod: 406, maxRes: 5445, maxCrop: 1210 },
    { level: 10, cost: 25255, prod: 560, maxRes: 9095, maxCrop: 2020 },
    { level: 11, cost: 42180, prod: 784, maxRes: 15185, maxCrop: 3375 },
    { level: 12, cost: 70445, prod: 1050, maxRes: 25360, maxCrop: 5635 },
    { level: 13, cost: 117640, prod: 1386, maxRes: 42350, maxCrop: 9410 },
    { level: 14, cost: 196445, prod: 1778, maxRes: 70720, maxCrop: 15715 },
    { level: 15, cost: 328070, prod: 2240, maxRes: 118105, maxCrop: 26245 },
    { level: 16, cost: 547880, prod: 2800, maxRes: 197240, maxCrop: 43830 },
    { level: 17, cost: 914960, prod: 3640, maxRes: 329385, maxCrop: 73195 },
    { level: 18, cost: 1527985, prod: 4480, maxRes: 550075, maxCrop: 122240 },
    { level: 19, cost: 2551735, prod: 5600, maxRes: 918625, maxCrop: 204140 },
    { level: 20, cost: 4261410, prod: 6860, maxRes: 1534105, maxCrop: 340915 },
    { level: 21, cost: 7116555, prod: 8540, maxRes: 2561960, maxCrop: 569325 },
    { level: 22, cost: 11884640, prod: 10500, maxRes: 4278470, maxCrop: 950770 }
];

const mill_data = [
    { cost: 0, maxRes: 0, maxCrop: 0 },
    { cost: 2560, maxRes: 500, maxCrop: 1240 },
    { cost: 4605, maxRes: 900, maxCrop: 2230 },
    { cost: 8295, maxRes: 1620, maxCrop: 4020 },
    { cost: 14925, maxRes: 2915, maxCrop: 7230 },
    { cost: 26875, maxRes: 5250, maxCrop: 13015 }
];

const bakery_data = [
    { cost: 0, maxRes: 0, maxCrop: 0 },
    { cost: 5150, maxRes: 1480, maxCrop: 1600 },
    { cost: 9270, maxRes: 2665, maxCrop: 2880 },
    { cost: 16690, maxRes: 4795, maxCrop: 5185 },
    { cost: 30035, maxRes: 8630, maxCrop: 9330 },
    { cost: 54060, maxRes: 15535, maxCrop: 16795 }
];

const hm_groups = [
    { targetLevel: 10, cost: 114240, maxRes: 9115, maxCrop: 3125 },
    { targetLevel: 15, cost: 383295, maxRes: 37935, maxCrop: 13005 },
    { targetLevel: 20, cost: 1595070, maxRes: 157865, maxCrop: 54125 }
];

const waterworks_data = [
    { level: 0, cost: 0, maxRes: 0, maxCrop: 0 },
    { level: 1, cost: 3105, maxRes: 945, maxCrop: 340 },
    { level: 2, cost: 4065, maxRes: 1240, maxCrop: 445 },
    { level: 3, cost: 5325, maxRes: 1620, maxCrop: 585 },
    { level: 4, cost: 6980, maxRes: 2125, maxCrop: 765 },
    { level: 5, cost: 9145, maxRes: 2785, maxCrop: 1000 },
    { level: 6, cost: 11975, maxRes: 3645, maxCrop: 1310 },
    { level: 7, cost: 15695, maxRes: 4775, maxCrop: 1720 },
    { level: 8, cost: 20555, maxRes: 6255, maxCrop: 2250 },
    { level: 9, cost: 26925, maxRes: 8195, maxCrop: 2950 },
    { level: 10, cost: 35280, maxRes: 10735, maxCrop: 3865 },
    { level: 11, cost: 46215, maxRes: 14065, maxCrop: 5060 },
    { level: 12, cost: 60545, maxRes: 18425, maxCrop: 6630 },
    { level: 13, cost: 79310, maxRes: 24135, maxCrop: 8685 },
    { level: 14, cost: 103895, maxRes: 31620, maxCrop: 11375 },
    { level: 15, cost: 136105, maxRes: 41420, maxCrop: 14905 },
    { level: 16, cost: 178300, maxRes: 54265, maxCrop: 19525 },
    { level: 17, cost: 233560, maxRes: 71085, maxCrop: 25575 },
    { level: 18, cost: 305965, maxRes: 93120, maxCrop: 33505 },
    { level: 19, cost: 400815, maxRes: 121985, maxCrop: 43890 },
    { level: 20, cost: 525070, maxRes: 159805, maxCrop: 57495 }
];

const warehouse_cap = [800, 1200, 1700, 2300, 3100, 4000, 5000, 6300, 7800, 9600, 11800, 14400, 17600, 21400, 25900, 31300, 37900, 45700, 55100, 66400, 80000];

function calcularProduccion(fields, M, P, oasis_bonuses_active, speed, OH_level) {
    let base_prod = 0;

    for (let lvl of fields) {
        let base_x1 = crop_data[lvl].prod / 2;
        base_prod += base_x1 * speed;
    }

    let multiplier = 1.0;
    multiplier += (M * 0.05);
    multiplier += (P * 0.05);

    let oasis_multiplier = 1 + (OH_level * 0.05);

    for (let b of oasis_bonuses_active) {
        multiplier += (b * oasis_multiplier);
    }

    let total_prod = base_prod * multiplier * 1.25;
    return Math.round(total_prod);
}

function calcularCapacidad(maxValor, esGranAlmacen, tipo) {
    let nombre = "";
    if (tipo === 'A') nombre = esGranAlmacen ? "G.A" : "A";
    if (tipo === 'G') nombre = esGranAlmacen ? "G.G" : "G";

    if (maxValor <= 800) return `1 ${nombre} [Niv. 0]`;

    const capacidades = esGranAlmacen
        ? warehouse_cap.map((cap, index) => index === 0 ? 800 : cap * 3)
        : warehouse_cap;

    const maxCap = esGranAlmacen ? 240000 : 80000;

    let fullBuildings = Math.floor(maxValor / maxCap);
    let remainder = maxValor % maxCap;

    if (remainder === 0 && fullBuildings > 0) {
        return `${fullBuildings} ${nombre} [Niv. 20]`;
    }

    let lvl = capacidades.findIndex(cap => cap >= remainder);
    if (lvl === -1 && remainder > 0) lvl = 20;

    let strings = [];
    if (fullBuildings > 0) {
        strings.push(`${fullBuildings} ${nombre} [Niv. 20]`);
    }
    if (lvl > 0) {
        strings.push(`1 ${nombre} [Niv. ${lvl}]`);
    }

    return strings.join(" + ");
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function calcularROI() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "";

    let speed = parseInt(document.getElementById('serverSpeed').value);
    let isEgyptian = document.getElementById('isEgyptian').value === 'yes';

    let raw_oasis = [
        parseFloat(document.getElementById('oasis1').value),
        parseFloat(document.getElementById('oasis2').value),
        parseFloat(document.getElementById('oasis3').value)
    ];
    let selected_oasis = raw_oasis.filter(v => v > 0).sort((a,b) => b - a);

    let fields = new Array(15).fill(0);
    let M = 0, P = 0, H = 0, OH = 0, O_idx = 0;

    let highest_max_res = 800;
    let highest_max_crop = 800;

    let current_prod = calcularProduccion(fields, M, P, [], speed, OH);

    let row = `<tr>
        <td class="array-text">[${M}, ${P}, ${H}, ${OH}]</td>
        <td class="array-text">[${fields.join(',')}]</td>
        <td>${current_prod}</td>
        <td>Inicio</td>
        <td class="cost-text">-</td>
        <td class="roi-text">-</td>
        <td class="storage-text">${calcularCapacidad(highest_max_res, false, 'A')}</td>
        <td class="granary-text">${calcularCapacidad(highest_max_crop, false, 'G')}</td>
        <td class="great-storage-text">${calcularCapacidad(highest_max_res, true, 'A')}</td>
        <td class="great-granary-text">${calcularCapacidad(highest_max_crop, true, 'G')}</td>
    </tr>`;
    tbody.innerHTML += row;

    let steps = 0;
    const maxSteps = 500;

    while (steps < maxSteps) {
        steps++;
        let options = [];

        let minFieldLvl = Math.min(...fields);
        if (minFieldLvl < 22) {
            let cost = crop_data[minFieldLvl + 1].cost;
            let newFields = [...fields];
            newFields[newFields.indexOf(minFieldLvl)]++;

            let newProd = calcularProduccion(newFields, M, P, selected_oasis.slice(0, O_idx), speed, OH);
            let extraProd = newProd - current_prod;
            let roiDays = (cost / extraProd) / 24;

            options.push({
                type: 'field',
                roi: roiDays,
                cost: cost,
                newProd: newProd,
                maxRes: crop_data[minFieldLvl + 1].maxRes,
                maxCrop: crop_data[minFieldLvl + 1].maxCrop,
                action: `Subir una Granja al nivel ${minFieldLvl + 1}`,
                execute: () => { fields[fields.indexOf(minFieldLvl)]++; }
            });
        }

        let maxFieldLvl = Math.max(...fields);
        if (M < 5 && maxFieldLvl >= 5) {
            let cost = mill_data[M + 1].cost;
            let newProd = calcularProduccion(fields, M + 1, P, selected_oasis.slice(0, O_idx), speed, OH);
            let extraProd = newProd - current_prod;
            let roiDays = (cost / extraProd) / 24;

            options.push({
                type: 'mill',
                roi: roiDays,
                cost: cost,
                newProd: newProd,
                maxRes: mill_data[M + 1].maxRes,
                maxCrop: mill_data[M + 1].maxCrop,
                action: `Subir Molino al nivel ${M + 1}`,
                execute: () => { M++; }
            });
        }

        if (P < 5 && M === 5 && maxFieldLvl >= 10) {
            let cost = bakery_data[P + 1].cost;
            let newProd = calcularProduccion(fields, M, P + 1, selected_oasis.slice(0, O_idx), speed, OH);
            let extraProd = newProd - current_prod;
            let roiDays = (cost / extraProd) / 24;

            options.push({
                type: 'bakery',
                roi: roiDays,
                cost: cost,
                newProd: newProd,
                maxRes: bakery_data[P + 1].maxRes,
                maxCrop: bakery_data[P + 1].maxCrop,
                action: `Subir Panadería al nivel ${P + 1}`,
                execute: () => { P++; }
            });
        }

        if (O_idx < selected_oasis.length) {
            let cost = hm_groups[O_idx].cost;
            let newOasisList = selected_oasis.slice(0, O_idx + 1);
            let newProd = calcularProduccion(fields, M, P, newOasisList, speed, OH);
            let extraProd = newProd - current_prod;
            let roiDays = (cost / extraProd) / 24;
            let targetHM = hm_groups[O_idx].targetLevel;
            let bonusStr = (selected_oasis[O_idx] * 100) + "%";

            options.push({
                type: 'oasis',
                roi: roiDays,
                cost: cost,
                newProd: newProd,
                maxRes: hm_groups[O_idx].maxRes,
                maxCrop: hm_groups[O_idx].maxCrop,
                action: `Subir H. Héroe a lvl ${targetHM} y anexar Oasis ${bonusStr}`,
                execute: () => { H = targetHM; O_idx++; }
            });
        }

        if (isEgyptian && O_idx > 0 && OH < 20) {
            let cost = waterworks_data[OH + 1].cost;
            let newProd = calcularProduccion(fields, M, P, selected_oasis.slice(0, O_idx), speed, OH + 1);
            let extraProd = newProd - current_prod;
            let roiDays = (cost / extraProd) / 24;

            options.push({
                type: 'waterworks',
                roi: roiDays,
                cost: cost,
                newProd: newProd,
                maxRes: waterworks_data[OH + 1].maxRes,
                maxCrop: waterworks_data[OH + 1].maxCrop,
                action: `Subir Obras Hidráulicas al nivel ${OH + 1}`,
                execute: () => { OH++; }
            });
        }

        if (options.length === 0) break;

        options.sort((a, b) => a.roi - b.roi);
        let bestOption = options[0];

        bestOption.execute();
        current_prod = bestOption.newProd;

        if (bestOption.maxRes > highest_max_res) highest_max_res = bestOption.maxRes;
        if (bestOption.maxCrop > highest_max_crop) highest_max_crop = bestOption.maxCrop;

        let actionClass = bestOption.type !== 'field' ? "action-highlight" : "";

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="array-text">[${M}, ${P}, ${H}, ${OH}]</td>
            <td class="array-text">[${fields.join(',')}]</td>
            <td>${current_prod}</td>
            <td class="${actionClass}">Paso ${steps}: ${bestOption.action}</td>
            <td class="cost-text">${formatNumber(bestOption.cost)}</td>
            <td class="roi-text">${bestOption.roi.toFixed(2)}</td>
            <td class="storage-text">${calcularCapacidad(highest_max_res, false, 'A')}</td>
            <td class="granary-text">${calcularCapacidad(highest_max_crop, false, 'G')}</td>
            <td class="great-storage-text">${calcularCapacidad(highest_max_res, true, 'A')}</td>
            <td class="great-granary-text">${calcularCapacidad(highest_max_crop, true, 'G')}</td>
        `;
        tbody.appendChild(tr);
    }
}

window.addEventListener("load", () => {
    const savedTheme = localStorage.getItem('theme');
    const btn = document.getElementById('themeToggle');

    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if (btn) btn.innerHTML = '🌙 Modo Oscuro';
    }

    if (btn) btn.addEventListener("click", toggleTheme);

    const calcBtn = document.getElementById("calcBtn");
    if (calcBtn) calcBtn.addEventListener("click", calcularROI);

    calcularROI();
});