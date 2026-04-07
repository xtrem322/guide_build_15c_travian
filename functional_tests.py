import http.server
import json
import os
import socketserver
import threading
import time
import tempfile
from contextlib import contextmanager

from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, TimeoutException, WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait


ROOT = os.path.dirname(os.path.abspath(__file__))

CAPACITY_EXAMPLE = """Privacy settings
4
‭3,201‬
‭2,031‬
‭80,000‬
‭20,835‬
‭22,648‬
‭14,339‬
‭66,400‬
‭12,118‬
‭5,630‬
Switch to avatar for sitting
Hero
Server time:  19:58:59
Alliance banner
SAQ 1
Info box
‭‭1‬×‬

    del
    Find out all details about the upcoming Easter truce in our article.

Link list

    Lista de Vacas
    LEER COSAS POR HACER
    Tropas en aldea
    Tiempo entrenamiento tropas

Village overview
Overview
Resources
Culture points
Troops

Resources

Warehouse

Production

Capacity
Village \tWarehouse \tGranary
Villa Zero \t‭45,700‬ \t‭55,100‬
FO001 \t‭80,000‬ \t‭80,000‬
FO002 \t‭80,000‬ \t‭66,400‬
Villa Pokemon \t‭240,000‬ \t‭480,000‬
Villa Tormento \t‭400,000‬ \t‭880,000‬
Villa Esperanza \t‭125,700‬ \t‭160,000‬
Villa Emoción \t‭85,000‬ \t‭125,700‬
Villa Charizard \t‭80,000‬ \t‭80,000‬
Ojitos Rojos \t‭45,700‬ \t‭21,400‬
Sum \t‭1,182,100‬ \t‭1,948,600‬
Team_Tocabolus
Population: ‭670‬
Loyalty: ‭‭100‬%‬
Villages ‭‭9‬/‭9‬‬

Village groups(‭‭5‬/‭20‬‬)
Zona Inicial
Villa Zero
‭(‭25‬|‭−‭53‬‬)‬
FO001
‭(‭23‬|‭−‭64‬‬)‬
FO002
‭(‭17‬|‭−‭89‬‬)‬
Capital
Villa Pokemon
‭(‭83‬|‭−‭166‬‬)‬
Gasolinera
Villa Tormento
‭(‭84‬|‭−‭165‬‬)‬
Aldeas OFF
Villa Esperanza
‭(‭84‬|‭−‭166‬‬)‬
Aldeas DEFF
Villa Emoción
‭(‭84‬|‭−‭164‬‬)‬
Villa Charizard
‭(‭83‬|‭−‭168‬‬)‬
Ojitos Rojos
‭(‭81‬|‭−‭168‬‬)‬
Task overview
Homepage Discord News Support Game rules Terms Imprint

© 2004 - 2026 Travian Games GmbH
"""

RESOURCES_EXAMPLE = """Privacy settings
3
â€­3,183â€¬
â€­2,031â€¬
â€­45,700â€¬
â€­11,882â€¬
â€­8,649â€¬
â€­3,860â€¬
â€­31,300â€¬
â€­14,393â€¬
â€­29â€¬
Switch to avatar for sitting
Hero
1
Server time:  21:03:00
Alliance banner
SAQ 1
Info box
â€­â€­1â€¬Ã—â€¬

    del
    Find out all details about the upcoming Easter truce in our article.

Link list

    Lista de Vacas
    LEER COSAS POR HACER
    Tropas en aldea
    Tiempo entrenamiento tropas

Village overview
Overview
Resources
Culture points
Troops

Resources

Warehouse

Production

Capacity
Village \t\t\t\t\tMerchants
Villa Zero \tâ€­6,809â€¬ \tâ€­7,327â€¬ \tâ€­6,807â€¬ \tâ€­14,285â€¬ \tâ€­â€­12â€¬/â€­12â€¬â€¬
FO001 \tâ€­10,511â€¬ \tâ€­12,128â€¬ \tâ€­6,553â€¬ \tâ€­14,960â€¬ \tâ€­â€­12â€¬/â€­12â€¬â€¬
FO002 \tâ€­8,504â€¬ \tâ€­14,515â€¬ \tâ€­3,632â€¬ \tâ€­10,972â€¬ \tâ€­â€­12â€¬/â€­12â€¬â€¬
Villa Pokemon \tâ€­4,921â€¬ \tâ€­4,921â€¬ \tâ€­4,922â€¬ \tâ€­199,584â€¬ \tâ€­â€­20â€¬/â€­20â€¬â€¬
Villa Tormento \tâ€­2,313â€¬ \tâ€­10,877â€¬ \tâ€­74,633â€¬ \tâ€­858,637â€¬ \tâ€­â€­20â€¬/â€­20â€¬â€¬
Villa Esperanza \tâ€­7,411â€¬ \tâ€­15,792â€¬ \tâ€­14,720â€¬ \tâ€­32,250â€¬ \tâ€­â€­17â€¬/â€­17â€¬â€¬
Villa EmociÃ³n \tâ€­3,449â€¬ \tâ€­25,637â€¬ \tâ€­12,998â€¬ \tâ€­13,813â€¬ \tâ€­â€­12â€¬/â€­12â€¬â€¬
Villa Charizard \tâ€­2,103â€¬ \tâ€­7,376â€¬ \tâ€­23,226â€¬ \tâ€­7,226â€¬ \tâ€­â€­13â€¬/â€­13â€¬â€¬
Ojitos Rojos \tâ€­11,882â€¬ \tâ€­8,649â€¬ \tâ€­3,860â€¬ \tâ€­14,393â€¬ \tâ€­â€­1â€¬/â€­1â€¬â€¬
Sum \tâ€­57,903â€¬ \tâ€­107,222â€¬ \tâ€­151,351â€¬ \tâ€­1,166,120â€¬ \tâ€­â€­119â€¬/â€­119â€¬â€¬
Team_Tocabolus
Population: â€­211â€¬
Loyalty: â€­â€­100â€¬%â€¬
Villages â€­â€­9â€¬/â€­9â€¬â€¬

Village groups(â€­â€­5â€¬/â€­20â€¬â€¬)
Zona Inicial
Villa Zero
â€­(â€­25â€¬|â€­âˆ’â€­53â€¬â€¬)â€¬
FO001
â€­(â€­23â€¬|â€­âˆ’â€­64â€¬â€¬)â€¬
FO002
â€­(â€­17â€¬|â€­âˆ’â€­89â€¬â€¬)â€¬
Capital
Villa Pokemon
â€­(â€­83â€¬|â€­âˆ’â€­166â€¬â€¬)â€¬
Gasolinera
Villa Tormento
â€­(â€­84â€¬|â€­âˆ’â€­165â€¬â€¬)â€¬
Aldeas OFF
Villa Esperanza
â€­(â€­84â€¬|â€­âˆ’â€­166â€¬â€¬)â€¬
Aldeas DEFF
Villa EmociÃ³n
â€­(â€­84â€¬|â€­âˆ’â€­164â€¬â€¬)â€¬
Villa Charizard
â€­(â€­83â€¬|â€­âˆ’â€­168â€¬â€¬)â€¬
Ojitos Rojos
â€­(â€­81â€¬|â€­âˆ’â€­168â€¬â€¬)â€¬
Task overview
Homepage Discord News Support Game rules Terms Imprint

Â© 2004 - 2026 Travian Games GmbH
"""

TRAINING_NAME_REPLACEMENTS = {
    "Villa Esperanza": "FH: Villa Esperanza",
    "Villa EmociÃ³n": "FGA: Villa EmociÃ³n",
    "Villa Emoción": "FGA: Villa Emoción",
    "Villa Charizard": "FGE: Villa Charizard",
    "Ojitos Rojos": "FR: Ojitos Rojos",
}


def with_training_prefixes(raw):
    text = raw
    for old, new in TRAINING_NAME_REPLACEMENTS.items():
        text = text.replace(old, new)
    return text


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


@contextmanager
def local_server():
    previous = os.getcwd()
    os.chdir(ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), QuietHandler)
    port = httpd.server_address[1]
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.2)
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        httpd.shutdown()
        httpd.server_close()
        os.chdir(previous)


def build_driver():
    path_entries = os.environ.get("PATH", "").split(os.pathsep)
    os.environ["PATH"] = os.pathsep.join(
        entry for entry in path_entries if "chromedriver" not in entry.lower() and entry.lower() != r"d:\python"
    )

    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,1200")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-background-networking")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-software-rasterizer")
    options.add_argument("--no-first-run")
    options.add_argument("--remote-debugging-pipe")

    driver_candidates = [
        os.environ.get("CHROMEDRIVER"),
    ]
    browser_candidates = [
        os.environ.get("CHROME_BINARY"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    ]

    driver_path = next((p for p in driver_candidates if p and os.path.exists(p)), None)
    browser_binary = next((p for p in browser_candidates if p and os.path.exists(p)), None)

    if browser_binary:
        options.binary_location = browser_binary

    service = Service(executable_path=driver_path) if driver_path else Service()
    profile_dir = tempfile.mkdtemp(prefix="travian-functional-")
    options.add_argument(f"--user-data-dir={profile_dir}")
    return webdriver.Chrome(service=service, options=options)


def wait_for(driver, css, timeout=10):
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, css))
    )


def assert_theme_toggle(driver):
    wait_for(driver, "#themeToggle")
    body = driver.find_element(By.TAG_NAME, "body")
    button = driver.find_element(By.ID, "themeToggle")

    initial = "dark" in body.get_attribute("class").split()
    button.click()
    WebDriverWait(driver, 5).until(
        lambda d: ("dark" in d.find_element(By.TAG_NAME, "body").get_attribute("class").split()) != initial
    )

    toggled = "dark" in driver.find_element(By.TAG_NAME, "body").get_attribute("class").split()
    assert toggled != initial, "El tema no cambio tras el primer click"

    button = driver.find_element(By.ID, "themeToggle")
    button.click()
    WebDriverWait(driver, 5).until(
        lambda d: ("dark" in d.find_element(By.TAG_NAME, "body").get_attribute("class").split()) == initial
    )


def test_theme_toggle(driver, base_url):
    paths = ["/roi/", "/npc/", "/npcentrenamiento/", "/npcgrandesfiestas/", "/oasis/", "/listadevacas/", "/cultura/"]
    for path in paths:
        driver.get(f"{base_url}{path}")
        assert_theme_toggle(driver)


def test_default_server_speed_x3(driver, base_url):
    paths = ["/roi/", "/npc/", "/npcentrenamiento/", "/oasis/", "/listadevacas/"]
    for path in paths:
        driver.get(f"{base_url}{path}")
        wait_for(driver, "#serverSpeed")
        speed = Select(driver.find_element(By.ID, "serverSpeed")).first_selected_option.get_attribute("value")
        assert speed == "3", f"{path} no inicia en velocidad x3"


def test_roi(driver, base_url):
    driver.get(f"{base_url}/roi/")
    wait_for(driver, "#calcBtn")
    driver.find_element(By.ID, "calcBtn").click()
    rows = driver.find_elements(By.CSS_SELECTOR, "#tableBody tr")
    assert len(rows) > 1, "ROI no genero pasos"


def test_npc(driver, base_url):
    driver.get(f"{base_url}/npc/")
    wait_for(driver, "#addRow")
    assert not driver.find_element(By.ID, "copyWood").is_displayed(), "El boton de madera no debe mostrarse sin datos"

    driver.find_element(By.ID, "addRow").click()
    wait_for(driver, "#rows tr")

    Select(driver.find_element(By.ID, "excessMode")).select_by_value("exact")
    cur_total = driver.find_element(By.ID, "curTotal")
    cur_total.clear()
    cur_total.send_keys("100000")
    WebDriverWait(driver, 5).until(lambda d: d.find_element(By.ID, "copyWood").is_displayed())

    expected_copy = driver.find_element(By.ID, "tgtWood").text
    driver.execute_script("window.__copiedNpcText = ''; navigator.clipboard.writeText = async (text) => { window.__copiedNpcText = text; };")
    driver.find_element(By.ID, "copyWood").click()
    WebDriverWait(driver, 5).until(
        lambda d: d.execute_script("return window.__copiedNpcText;") == expected_copy
    )

    time_before = driver.find_element(By.CSS_SELECTOR, "#exactTroopMatrix .tm-cell.tm-time").text
    Select(driver.find_element(By.ID, "serverSpeed")).select_by_value("1")
    WebDriverWait(driver, 5).until(
        lambda d: d.find_element(By.CSS_SELECTOR, "#exactTroopMatrix .tm-cell.tm-time").text != time_before
    )
    status = driver.find_element(By.ID, "statusLine").text
    assert "OK" in status or "NO ALCANZA" in status, "NPC no actualizo estado"


def test_oasis(driver, base_url):
    driver.get(f"{base_url}/oasis/")
    wait_for(driver, "#btnProcess")
    textarea = driver.find_element(By.ID, "taImport")
    textarea.send_keys("Oasis desocupado 12.4\n1\n24.2.2026\nOasis desocupado 07.8\n1\n24.2.2026")
    driver.find_element(By.ID, "btnProcess").click()
    rows = driver.find_elements(By.CSS_SELECTOR, "#oasisTableBody .oasis-row")
    assert len(rows) == 2, "Oasis no proceso las filas esperadas"
    assert driver.find_element(By.ID, "globalResult").is_displayed(), "Oasis no mostro resultado global"


def test_vacas(driver, base_url):
    driver.get(f"{base_url}/listadevacas/")
    wait_for(driver, "#btnProcess")
    textarea = driver.find_element(By.ID, "taImport")
    textarea.send_keys("Granja Roja 40 3\n1")
    driver.find_element(By.ID, "btnProcess").click()
    rows = driver.find_elements(By.CSS_SELECTOR, "#oasisTableBody .oasis-row")
    assert len(rows) == 1, "Lista de vacas no proceso la fila"
    assert driver.find_element(By.ID, "globalResult").is_displayed(), "Lista de vacas no mostro resultado global"


def test_cultura(driver, base_url):
    driver.get(f"{base_url}/cultura/")
    wait_for(driver, "#btnAddBuilding")
    Select(driver.find_element(By.ID, "villageLayout")).select_by_value("3-4-5-6")
    WebDriverWait(driver, 5).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "#matrixBody .matrix-row")) >= 4
    )
    granja_row = next(
        row for row in driver.find_elements(By.CSS_SELECTOR, "#matrixBody .matrix-row")
        if "GRANJA" in row.find_element(By.TAG_NAME, "select").get_attribute("value")
    )
    qty_input = granja_row.find_elements(By.CSS_SELECTOR, "input[type='number']")[0]
    assert qty_input.get_attribute("value") == "6", "Cultura no aplico cantidad del layout 3-4-5-6"
    driver.find_element(By.ID, "btnCalc").click()
    WebDriverWait(driver, 20).until(
        lambda d: d.find_element(By.ID, "resultPanel").is_displayed()
    )
    assert driver.find_elements(By.CSS_SELECTOR, "#resultTableBody .rc-qty"), "Cultura no mostro la columna de cantidad"


def test_npc_training_capacity_parser(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    rows = driver.execute_script(
        "return parseTravianTable(arguments[0], parseCapacityRow, 'capacity');",
        CAPACITY_EXAMPLE
    )

    assert len(rows) == 9, f"Se esperaban 9 aldeas en capacidad y llegaron {len(rows)}"

    by_name = {row["name"]: row for row in rows}
    assert by_name["Villa Zero"]["warehouseCap"] == 45700, "Villa Zero no parseo almacen"
    assert by_name["Villa Zero"]["granaryCap"] == 55100, "Villa Zero no parseo granero"
    assert by_name["FO002"]["warehouseCap"] == 80000, "FO002 no parseo almacen"
    assert by_name["FO002"]["granaryCap"] == 66400, "FO002 no parseo granero"
    assert by_name["Villa Tormento"]["warehouseCap"] == 400000, "Villa Tormento no parseo almacen"
    assert by_name["Villa Tormento"]["granaryCap"] == 880000, "Villa Tormento no parseo granero"


def test_npc_training_capacity_import_without_resources(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    capacity_training = with_training_prefixes(CAPACITY_EXAMPLE)
    driver.execute_script(
        "document.getElementById('trainingCapacityInput').value = arguments[0];",
        capacity_training
    )
    driver.find_element(By.ID, "btnImportTraining").click()

    WebDriverWait(driver, 10).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "#trainingVillageBody tr")) == 4
    )

    status = driver.find_element(By.ID, "trainingImportStatus").text
    page_status = driver.find_element(By.ID, "statusLine").text
    central_options = Select(driver.find_element(By.ID, "trainingCentralVillage")).options
    assert "Importadas: 9" in status and "Entrenamiento: 4" in status, "NPC entrenamiento no separo aldeas importadas y aldeas de entrenamiento"
    assert "Falta pegar Los Recursos para 9" in page_status, "NPC entrenamiento no aviso que faltan recursos tras importar capacidad"
    assert len(central_options) == 9, "NPC entrenamiento no mantuvo las 9 aldeas como candidatas a central"


def test_npc_training_resources_parser(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    rows = driver.execute_script(
        "return parseTravianTable(arguments[0], parseResourcesRow, 'resources');",
        RESOURCES_EXAMPLE
    )

    assert len(rows) == 9, f"Se esperaban 9 aldeas en recursos y llegaron {len(rows)}"

    by_name = {row["name"]: row for row in rows}
    assert by_name["Villa Zero"]["current"]["wood"] == 6809, "Villa Zero no parseo madera"
    assert by_name["Villa Zero"]["current"]["crop"] == 14285, "Villa Zero no parseo cereal"
    assert by_name["Villa Tormento"]["current"]["iron"] == 74633, "Villa Tormento no parseo hierro"
    assert by_name["Ojitos Rojos"]["current"]["crop"] == 14393, "Ojitos Rojos no parseo cereal"


def test_npc_training_capacity_and_resources_import(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    capacity_training = with_training_prefixes(CAPACITY_EXAMPLE)
    resources_training = with_training_prefixes(RESOURCES_EXAMPLE)
    driver.execute_script(
        "document.getElementById('trainingCapacityInput').value = arguments[0];"
        "document.getElementById('trainingResourcesInput').value = arguments[1];",
        capacity_training,
        resources_training
    )
    driver.find_element(By.ID, "btnImportTraining").click()

    WebDriverWait(driver, 10).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "#trainingVillageBody tr")) == 4
    )

    status = driver.find_element(By.ID, "trainingImportStatus").text
    central_options = Select(driver.find_element(By.ID, "trainingCentralVillage")).options
    race_cells = [cell.text for cell in driver.find_elements(By.CSS_SELECTOR, "#trainingVillageBody tr td:nth-child(2)")]
    assert "Cruce valido: 9" in status and "Entrenamiento: 4" in status, "NPC entrenamiento no cruzo bien las aldeas importadas y de entrenamiento"
    assert len(central_options) == 9, "NPC entrenamiento no lleno las candidatas a aldea central"
    assert {"GALOS", "GERMANO", "HUNOS", "ROMANO"}.issubset(set(race_cells)), "NPC entrenamiento no detecto la raza desde las siglas del nombre"


def test_npc_training_import_preserves_resource_order(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    capacity_training = with_training_prefixes(CAPACITY_EXAMPLE)
    resources_training = with_training_prefixes(RESOURCES_EXAMPLE)
    driver.execute_script(
        "document.getElementById('trainingCapacityInput').value = arguments[0];"
        "document.getElementById('trainingResourcesInput').value = arguments[1];",
        capacity_training,
        resources_training
    )
    driver.find_element(By.ID, "btnImportTraining").click()

    WebDriverWait(driver, 10).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "#trainingVillageBody tr")) == 4
    )

    village_order = [
        cell.text.strip()
        for cell in driver.find_elements(By.CSS_SELECTOR, "#trainingVillageBody tr td:first-child")
    ]
    central_labels = [
        option.text.strip()
        for option in Select(driver.find_element(By.ID, "trainingCentralVillage")).options
    ]

    assert village_order == [
        "Villa Esperanza",
        "Villa Emoción",
        "Villa Charizard",
        "Ojitos Rojos",
    ], "NPC entrenamiento reordeno las aldeas de entrenamiento en vez de respetar el orden del pegado de recursos"
    assert central_labels[:4] == [
        "Villa Zero - Total 35228",
        "FO001 - Total 44152",
        "FO002 - Total 37623",
        "Villa Pokemon - Total 214348",
    ], "La lista de aldea central no respeto el orden original del pegado de recursos"


def test_npc_training_central_total_and_village_transfers(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_script(
        """
        const originalGetTrainingRequirement = getTrainingRequirement;
        const originalFindVillageCurrentTime = findVillageCurrentTime;
        const originalGetTrainingCentralCandidates = getTrainingCentralCandidates;
        try {
          const fake = (name, key, current, isTraining) => ({
            id: key,
            name,
            key,
            race: "ROMANO",
            raceSupported: true,
            isTraining,
            warehouseCap: 999999,
            granaryCap: 999999,
            current: withResourceTotal(current),
            hasResources: true,
            barracksTroop: "X",
            stableTroop: "Y",
            workshopTroop: "",
            barracksLvl: 1,
            stableLvl: 1,
            workshopLvl: 1,
            allyBonus: 0,
            trooperBoost: 0,
            helmetBarracks: 0,
            helmetStable: 0
          });

          allVillages = [
            fake("Central", "central", { wood: 1000, clay: 0, iron: 0, crop: 0 }, false),
            fake("FA Aldea A", "a", { wood: 300, clay: 0, iron: 0, crop: 0 }, true),
            fake("FR Aldea B", "b", { wood: 0, clay: 0, iron: 300, crop: 0 }, true)
          ];
          trainingVillages = allVillages.filter(v => v.isTraining);
          trainingCentralKey = "central";

          getTrainingRequirement = (village) => {
            if (village.key === "a") return { queues:[{label:"C"}], counts:[{label:"C", units:10}], resources: withResourceTotal({ wood: 100, clay: 0, iron: 200, crop: 0 }) };
            if (village.key === "b") return { queues:[{label:"E"}], counts:[{label:"E", units:10}], resources: withResourceTotal({ wood: 300, clay: 0, iron: 0, crop: 0 }) };
            return { queues:[], counts:[], resources: zeroResources() };
          };
          findVillageCurrentTime = (village) => village.key === "a" ? 60 : 120;
          getTrainingCentralCandidates = () => allVillages.slice();

          const plan = evaluateTrainingTarget(300);
          return {
            feasible: plan.feasible,
            npcTotal: plan.totalTransfer.total,
            npcWood: plan.totalTransfer.wood,
            npcIron: plan.totalTransfer.iron,
            transfers: plan.villageTransfers,
            statuses: plan.villagePlans.map(item => ({ name: item.village.name, status: item.status }))
          };
        } finally {
          getTrainingRequirement = originalGetTrainingRequirement;
          findVillageCurrentTime = originalFindVillageCurrentTime;
          getTrainingCentralCandidates = originalGetTrainingCentralCandidates;
        }
        """
    )

    assert result["feasible"], "NPC entrenamiento no considero a la central como bolsa total"
    assert result["npcTotal"] == 100 and result["npcWood"] == 100 and result["npcIron"] == 0, "NPC entrenamiento no optimizo el faltante restante en la central"
    assert len(result["transfers"]) == 2, "NPC entrenamiento no genero envios entre aldeas cuando habia excedentes utiles"
    assert {item["status"] for item in result["statuses"]} == {"Envio", "NPC"}, "NPC entrenamiento no distinguio entre apoyo entre aldeas y NPC central"


def test_npc_training_central_capacity_cap(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_script(
        """
        const originalGetTrainingRequirement = getTrainingRequirement;
        const originalFindVillageCurrentTime = findVillageCurrentTime;
        const originalGetTrainingCentralCandidates = getTrainingCentralCandidates;
        try {
          const fake = (name, key, current, isTraining, warehouseCap, granaryCap) => ({
            id: key,
            name,
            key,
            race: "ROMANO",
            raceSupported: true,
            isTraining,
            warehouseCap,
            granaryCap,
            current: withResourceTotal(current),
            hasResources: true,
            barracksTroop: "X",
            stableTroop: "",
            workshopTroop: "",
            barracksLvl: 1,
            stableLvl: 1,
            workshopLvl: 1,
            allyBonus: 0,
            trooperBoost: 0,
            helmetBarracks: 0,
            helmetStable: 0
          });

          allVillages = [
            fake("Central", "central", { wood: 1000, clay: 1000, iron: 1000, crop: 1000 }, false, 300, 800),
            fake("FR Aldea A", "a", { wood: 0, clay: 0, iron: 0, crop: 0 }, true, 999999, 999999)
          ];
          trainingVillages = allVillages.filter(v => v.isTraining);
          trainingCentralKey = "central";

          getTrainingRequirement = () => ({
            queues:[{label:"C"}],
            counts:[{label:"C", units:10}],
            resources: withResourceTotal({ wood: 450, clay: 250, iron: 300, crop: 0 })
          });
          findVillageCurrentTime = () => 0;
          getTrainingCentralCandidates = () => allVillages.slice();

          const plan = evaluateTrainingTarget(300);
          return {
            feasible: plan.feasible,
            reason: plan.reason || ""
          };
        } finally {
          getTrainingRequirement = originalGetTrainingRequirement;
          findVillageCurrentTime = originalFindVillageCurrentTime;
          getTrainingCentralCandidates = originalGetTrainingCentralCandidates;
        }
        """
    )

    assert not result["feasible"], "NPC entrenamiento no puso el tope por recurso del almacen/granero central"
    assert "tope de madera del almacen central (300)" in result["reason"], "NPC entrenamiento no explico el tope por recurso de la central"


def test_npc_training_npc_central_boxes(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_script(
        """
        renderTrainingResult({
          feasible: true,
          targetSec: 120,
          totalTransfer: withResourceTotal({ wood: 323401, clay: 244262, iron: 215471, crop: 54486 }),
          villageTransfers: [],
          central: { name: "Central" },
          centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
          activeQueues: 2,
          villagePlans: []
        });
        return {
          labels: [...document.querySelectorAll('.npc-central-label')].map(x => x.textContent.trim()),
          values: [...document.querySelectorAll('.npc-central-value')].map(x => x.textContent.trim())
        };
        """
    )

    assert result["labels"] == ["Madera", "Barro", "Hierro", "Cereal"], "NPC central no mostro los cuatro cuadros etiquetados"
    assert result["values"] == ["323401", "244262", "215471", "54486"], "NPC central no mostro los valores en los cuadros correctos"


def test_npc_training_central_overview_cards(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    capacity_training = with_training_prefixes(CAPACITY_EXAMPLE)
    resources_training = with_training_prefixes(RESOURCES_EXAMPLE)
    driver.execute_script(
        "document.getElementById('trainingCapacityInput').value = arguments[0];"
        "document.getElementById('trainingResourcesInput').value = arguments[1];",
        capacity_training,
        resources_training
    )
    driver.find_element(By.ID, "btnImportTraining").click()

    WebDriverWait(driver, 10).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, ".training-central-card")) == 4
    )

    labels = [
        item.text.strip()
        for item in driver.find_elements(By.CSS_SELECTOR, ".training-central-card-label")
    ]
    values = [
        item.text.strip()
        for item in driver.find_elements(By.CSS_SELECTOR, ".training-central-card-value")
    ]

    assert labels == [
        "CENTRAL ELEGIDA",
        "RECURSOS ACTUALES",
        "CAPACIDAD MAXIMA",
        "TOTAL DISPONIBLE",
    ], "La seccion de aldea central no quedo separada en bloques entendibles"
    assert values[0] == "Villa Tormento", "La tarjeta principal de aldea central no mostro la aldea seleccionada"
    assert values[3] == "946460", "La tarjeta de total disponible no mostro la suma de recursos de la central"


def test_npc_training_split_buttons(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    driver.execute_script(
        """
        trainingSplitModeByVillage = {};
        renderTrainingResult({
          feasible: true,
          targetSec: 120,
          totalTransfer: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central: { name: "Central" },
          centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
          activeQueues: 2,
          villagePlans: [{
            village: { key: "villa-a", name: "Villa A" },
            status: "NPC",
            currentTime: 0,
            counts: [{ label:"C", units:341 }, { label:"E", units:57 }],
            deficit: withResourceTotal({ wood: 64618, clay: 65521, iron: 83615, crop: 27932 })
          }]
        });
        """
    )

    driver.find_element(By.CSS_SELECTOR, '.split-toggle-btn[data-factor="2"]').click()
    labels_after_2 = [el.text for el in driver.find_elements(By.CSS_SELECTOR, ".split-subvalue")]
    active_after_2 = driver.find_elements(By.CSS_SELECTOR, '.split-toggle-btn.active[data-factor="2"]')
    inactive_3 = driver.find_elements(By.CSS_SELECTOR, '.split-toggle-btn.active[data-factor="3"]')

    driver.find_element(By.CSS_SELECTOR, '.split-toggle-btn[data-factor="3"]').click()
    labels_after_3 = [el.text for el in driver.find_elements(By.CSS_SELECTOR, ".split-subvalue")]
    active_after_3 = driver.find_elements(By.CSS_SELECTOR, '.split-toggle-btn.active[data-factor="3"]')
    inactive_2 = driver.find_elements(By.CSS_SELECTOR, '.split-toggle-btn.active[data-factor="2"]')

    assert any("x2: C:171" in text and "E:29" in text for text in labels_after_2), "Entre 2 no dividio las tropas en la segunda linea"
    assert any("x2: 32309" in text for text in labels_after_2), "Entre 2 no dividio los recursos en la segunda linea"
    assert len(active_after_2) == 1 and len(inactive_3) == 0, "Entre 2 no quedo como unico boton activo"
    assert any("x3: C:114" in text and "E:19" in text for text in labels_after_3), "Entre 3 no dividio las tropas en la segunda linea"
    assert any("x3: 21540" in text for text in labels_after_3), "Entre 3 no dividio los recursos en la segunda linea"
    assert len(active_after_3) == 1 and len(inactive_2) == 0, "Entre 3 no reemplazo correctamente al boton activo"


def test_npc_training_global_modifiers(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    capacity_training = with_training_prefixes(CAPACITY_EXAMPLE)
    resources_training = with_training_prefixes(RESOURCES_EXAMPLE)
    driver.execute_script(
        "document.getElementById('trainingCapacityInput').value = arguments[0];"
        "document.getElementById('trainingResourcesInput').value = arguments[1];",
        capacity_training,
        resources_training
    )
    driver.find_element(By.ID, "btnImportTraining").click()

    WebDriverWait(driver, 10).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "#trainingVillageBody tr")) == 4
    )

    headers_before = [cell.text.strip() for cell in driver.find_elements(By.CSS_SELECTOR, "#trainingHeaderRow th")]
    assert "Alianza" not in headers_before, "La alianza debe estar solo como configuracion global"
    assert "Tropero" in headers_before, "Tropero debe seguir local mientras no se active el modo global"
    assert "Casco C" in headers_before and "Casco E" in headers_before, "Los cascos deben seguir locales mientras no se active el modo global"

    assert not driver.find_element(By.ID, "globalTrooperWrap").is_displayed(), "El selector global de tropero no debe mostrarse antes del check"
    assert not driver.find_element(By.ID, "globalHelmetBarracksWrap").is_displayed(), "El casco global no debe mostrarse antes del check"
    assert not driver.find_element(By.ID, "globalHelmetStableWrap").is_displayed(), "El casco global no debe mostrarse antes del check"

    driver.find_element(By.ID, "globalTrooperEnabled").click()
    driver.find_element(By.ID, "globalHelmetEnabled").click()

    WebDriverWait(driver, 10).until(lambda d: d.find_element(By.ID, "globalTrooperWrap").is_displayed())
    WebDriverWait(driver, 10).until(lambda d: d.find_element(By.ID, "globalHelmetBarracksWrap").is_displayed())
    WebDriverWait(driver, 10).until(lambda d: d.find_element(By.ID, "globalHelmetStableWrap").is_displayed())

    headers_after = [cell.text.strip() for cell in driver.find_elements(By.CSS_SELECTOR, "#trainingHeaderRow th")]
    assert "Tropero" not in headers_after, "Tropero no salio de la matriz al activar el modo global"
    assert "Casco C" not in headers_after and "Casco E" not in headers_after, "Los cascos no salieron de la matriz al activar el modo global"


def test_npc_training_queue_names(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    driver.execute_script(
        """
        trainingSplitModeByVillage = {};
        renderTrainingResult({
          feasible: true,
          targetSec: 120,
          totalTransfer: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central: { name: "Central" },
          centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
          activeQueues: 2,
          villagePlans: [{
            village: { key: "villa-a", name: "Villa A" },
            status: "NPC",
            currentTime: 0,
            counts: [{ label:"C", troopName:"Imperiano", units:341 }, { label:"E", troopName:"Equites Imperatoris", units:57 }],
            deficit: withResourceTotal({ wood: 64618, clay: 65521, iron: 83615, crop: 27932 })
          }]
        });
        """
    )

    queue_cell = driver.find_element(By.CSS_SELECTOR, ".training-transfer-table tbody tr td:nth-child(5)")
    assert "C: Imperiano 341" in queue_cell.text, "La columna Colas no mostro el nombre de la unidad del cuartel"
    assert "E: Equites Imperatoris 57" in queue_cell.text, "La columna Colas no mostro el nombre de la unidad del establo"

    driver.find_element(By.CSS_SELECTOR, '.split-toggle-btn[data-factor="2"]').click()
    WebDriverWait(driver, 5).until(lambda d: "x2:" in d.find_element(By.CSS_SELECTOR, ".training-transfer-table tbody tr td:nth-child(5)").text)
    split_text = driver.find_element(By.CSS_SELECTOR, ".training-transfer-table tbody tr td:nth-child(5)").text
    assert "x2: C: Imperiano 171" in split_text, "Entre 2 no mantuvo el nombre de unidad en la segunda linea"


def test_npc_training_resource_icons(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_script(
        """
        renderTrainingResult({
          feasible: true,
          targetSec: 120,
          totalTransfer: withResourceTotal({ wood: 323401, clay: 244262, iron: 215471, crop: 54486 }),
          villageTransfers: [],
          central: { name: "Central" },
          centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
          activeQueues: 2,
          villagePlans: [{
            village: { key: "villa-a", name: "Villa A" },
            status: "NPC",
            currentTime: 857,
            counts: [{ label:"C", troopName:"Imperiano", units:341 }],
            deficit: withResourceTotal({ wood: 64618, clay: 65521, iron: 83615, crop: 27932 })
          }]
        });
        return {
          wide: document.querySelector('.training-result-meta-wide .training-summary-card-wide') !== null,
          icons: [...document.querySelectorAll('.npc-central-item .resource-pill-icon')].map(x => x.getAttribute('src')),
          tableIcons: [...document.querySelectorAll('.training-transfer-table thead .resource-pill-icon')].map(x => x.getAttribute('src'))
        };
        """
    )

    assert result["wide"], "NPC central no ocupo el ancho completo del bloque"
    assert len(result["icons"]) == 4 and all("icons/" in item for item in result["icons"]), "NPC central no mostro iconos en los cuatro recursos"
    assert len(result["tableIcons"]) == 4 and all("icons/" in item for item in result["tableIcons"]), "La tabla no mostro iconos en los encabezados de recursos"


def test_npc_training_total_and_capacity_fit_columns(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_script(
        """
        const villageA = {
          key: "villa-a",
          name: "Villa A",
          sourceOrder: 0,
          current: withResourceTotal({ wood: 300000, clay: 10000, iron: 5000, crop: 1000 }),
          warehouseCap: 350000,
          granaryCap: 50000
        };
        const villageB = {
          key: "villa-b",
          name: "Villa B",
          sourceOrder: 1,
          current: withResourceTotal({ wood: 330000, clay: 10000, iron: 5000, crop: 49000 }),
          warehouseCap: 350000,
          granaryCap: 50000
        };

        renderTrainingResult({
          feasible: true,
          targetSec: 120,
          totalTransfer: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central: { name: "Central" },
          centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
          activeQueues: 2,
          villagePlans: [
            {
              village: villageA,
              status: "NPC",
              currentTime: 0,
              counts: [{ label:"C", troopName:"Imperiano", units:100 }],
              deficit: withResourceTotal({ wood: 40000, clay: 1000, iron: 2000, crop: 1000 })
            },
            {
              village: villageB,
              status: "NPC",
              currentTime: 0,
              counts: [{ label:"C", troopName:"Imperiano", units:90 }],
              deficit: withResourceTotal({ wood: 40000, clay: 2000, iron: 1000, crop: 2000 })
            }
          ]
        });

        const headers = [...document.querySelectorAll('.training-transfer-table thead th')].map(item => item.textContent.trim());
        const totalA = document.querySelector('[data-village-key="villa-a"] td:nth-child(10)').textContent.trim();
        const fitA = document.querySelector('[data-village-key="villa-a"] td:nth-child(11)').textContent.trim();
        const totalB = document.querySelector('[data-village-key="villa-b"] td:nth-child(10)').textContent.trim();
        const fitB = document.querySelector('[data-village-key="villa-b"] td:nth-child(11)').textContent.trim();

        return { headers, totalA, fitA, totalB, fitB };
        """
    )

    assert "Total" in result["headers"], "La matriz no agrego la columna Total"
    assert "CALZA?" in result["headers"], "La matriz no agrego la columna CALZA?"
    assert result["totalA"].startswith("44000"), "La columna Total no sumo correctamente los recursos a enviar"
    assert result["fitA"].startswith("SI"), "CALZA? debia indicar SI cuando todos los recursos entran en almacen/granero"
    assert result["totalB"].startswith("45000"), "La columna Total no sumo correctamente la segunda fila"
    assert result["fitB"].startswith("NO"), "CALZA? debia indicar NO cuando algun recurso supera la capacidad"


def test_npc_training_delivered_and_delete_controls(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    driver.execute_script(
        """
        const makeVillage = (name, key, sourceOrder) => ({
          id: key,
          name,
          key,
          sourceOrder,
          race: "ROMANO",
          raceSupported: true,
          isTraining: true,
          isDelivered: false,
          isExcluded: false,
          warehouseCap: 999999,
          granaryCap: 999999,
          current: withResourceTotal({ wood: 1000, clay: 1000, iron: 1000, crop: 1000 }),
          hasResources: true,
          barracksTroop: "X",
          stableTroop: "",
          workshopTroop: "",
          barracksLvl: 1,
          stableLvl: 1,
          workshopLvl: 1,
          allyBonus: 0,
          trooperBoost: 0,
          helmetBarracks: 0,
          helmetStable: 0
        });

        const villageA = makeVillage("Villa A", "a", 0);
        const villageB = makeVillage("Villa B", "b", 1);
        const villageC = makeVillage("Villa C", "c", 2);

        allVillages = [villageA, villageB, villageC];
        trainingVillages = [villageA, villageB, villageC];
        trainingCentralKey = "";
        trainingSplitModeByVillage = {};
        window.__recalcHits = 0;
        window.__originalRecalc = recalc;
        recalc = () => { window.__recalcHits += 1; };

        renderTrainingResult({
          feasible: true,
          targetSec: 120,
          totalTransfer: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central: { name: "Central" },
          centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
          activeQueues: 3,
          villagePlans: [
            { village: villageA, status: "NPC", currentTime: 0, counts: [{ label:"C", troopName:"Imperiano", units:100 }], deficit: withResourceTotal({ wood: 100, clay: 100, iron: 100, crop: 100 }) },
            { village: villageB, status: "Lista", currentTime: 0, counts: [{ label:"C", troopName:"Imperiano", units:90 }], deficit: withResourceTotal({ wood: 90, clay: 90, iron: 90, crop: 90 }) },
            { village: villageC, status: "Lista", currentTime: 0, counts: [{ label:"C", troopName:"Imperiano", units:80 }], deficit: withResourceTotal({ wood: 80, clay: 80, iron: 80, crop: 80 }) }
          ]
        });
        """
    )

    driver.find_element(By.CSS_SELECTOR, '.training-delivered-check[data-village-key="a"]').click()
    WebDriverWait(driver, 5).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, ".training-transfer-table tbody tr")[-1].get_attribute("data-village-key") == "a"
    )

    delivered_state = driver.execute_script(
        """
        const rows = [...document.querySelectorAll('.training-transfer-table tbody tr')].map(row => ({
          key: row.getAttribute('data-village-key'),
          delivered: row.classList.contains('is-delivered')
        }));
        const deliveredRow = document.querySelector('.training-transfer-row.is-delivered');
        const nameEl = deliveredRow ? deliveredRow.querySelector('.training-village-name') : null;
        const numberEl = deliveredRow ? deliveredRow.querySelector('td:nth-child(6) .split-cell-main') : null;
        return {
          rows,
          excludedBeforeDelete: allVillages.find(v => v.key === 'b').isExcluded,
          nameStyle: nameEl ? window.getComputedStyle(nameEl).textDecorationLine : "",
          numberStyle: numberEl ? window.getComputedStyle(numberEl).textDecorationLine : ""
        };
        """
    )

    driver.find_element(By.CSS_SELECTOR, '.training-row-delete-btn[data-village-key="b"]').click()
    after_delete = driver.execute_script(
        """
        const restore = window.__originalRecalc;
        const state = {
          excluded: allVillages.find(v => v.key === 'b').isExcluded,
          effectiveKeys: getEffectiveTrainingVillages().map(v => v.key),
          recalcHits: window.__recalcHits
        };
        recalc = restore;
        return state;
        """
    )

    assert [item["key"] for item in delivered_state["rows"]] == ["b", "c", "a"], "La fila marcada como entregada no se mando al final"
    assert delivered_state["rows"][-1]["delivered"], "La fila entregada no recibio el estilo gris/tachado"
    assert delivered_state["nameStyle"] == "line-through", "El nombre de la aldea entregada no quedo tachado"
    assert delivered_state["numberStyle"] == "none", "Los valores numericos de la aldea entregada no debian quedar tachados"
    assert not delivered_state["excludedBeforeDelete"], "La aldea ya estaba excluida antes de usar la papelera"
    assert after_delete["excluded"], "La papelera no marco la aldea como excluida"
    assert after_delete["effectiveKeys"] == ["a", "c"], "La papelera no saco la aldea del conjunto usado para el calculo"
    assert after_delete["recalcHits"] == 1, "La papelera no disparo el recalculo de la matriz"


def test_npc_training_mobile_horizontal_scroll(driver, base_url):
    original_size = driver.get_window_size()
    try:
        driver.set_window_size(390, 844)
        driver.get(f"{base_url}/npcentrenamiento/")
        wait_for(driver, "#btnImportTraining")

        capacity_training = with_training_prefixes(CAPACITY_EXAMPLE)
        resources_training = with_training_prefixes(RESOURCES_EXAMPLE)
        driver.execute_script(
            "document.getElementById('trainingCapacityInput').value = arguments[0];"
            "document.getElementById('trainingResourcesInput').value = arguments[1];",
            capacity_training,
            resources_training
        )
        driver.find_element(By.ID, "btnImportTraining").click()

        WebDriverWait(driver, 10).until(
            lambda d: len(d.find_elements(By.CSS_SELECTOR, "#trainingVillageBody tr")) == 4
        )

        config_scroll = driver.execute_script(
            """
            const scroller = document.querySelector('.training-table-scroll');
            const before = scroller.scrollLeft;
            scroller.scrollLeft = 260;
            return {
              clientWidth: scroller.clientWidth,
              scrollWidth: scroller.scrollWidth,
              before,
              after: scroller.scrollLeft,
              overflowX: getComputedStyle(scroller).overflowX
            };
            """
        )

        driver.execute_script(
            """
            trainingSplitModeByVillage = {};
            renderTrainingResult({
              feasible: true,
              targetSec: 120,
              totalTransfer: withResourceTotal({ wood: 323401, clay: 244262, iron: 215471, crop: 54486 }),
              villageTransfers: [],
              central: { name: "Central" },
              centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
              activeQueues: 2,
              villagePlans: [{
                village: {
                  key: "villa-a",
                  name: "Villa A",
                  sourceOrder: 0,
                  current: withResourceTotal({ wood: 300000, clay: 10000, iron: 5000, crop: 1000 }),
                  warehouseCap: 350000,
                  granaryCap: 50000
                },
                status: "NPC",
                currentTime: 0,
                counts: [{ label:"C", troopName:"Imperiano", units:341 }, { label:"E", troopName:"Equites Imperatoris", units:57 }],
                deficit: withResourceTotal({ wood: 64618, clay: 65521, iron: 83615, crop: 27932 })
              }]
            });
            """
        )

        result_scroll = driver.execute_script(
            """
            const scroller = document.getElementById('trainingResultBody');
            const before = scroller.scrollLeft;
            scroller.scrollLeft = 260;
            return {
              clientWidth: scroller.clientWidth,
              scrollWidth: scroller.scrollWidth,
              before,
              after: scroller.scrollLeft,
              overflowX: getComputedStyle(scroller).overflowX
            };
            """
        )
    finally:
        driver.set_window_size(original_size["width"], original_size["height"])

    assert config_scroll["scrollWidth"] > config_scroll["clientWidth"], "La tabla de configuracion no excedio el ancho en movil para poder desplazar"
    assert config_scroll["after"] > config_scroll["before"], "La tabla de configuracion no permitio desplazamiento horizontal en movil"
    assert config_scroll["overflowX"] in ("auto", "scroll"), "La tabla de configuracion no dejo habilitado el overflow horizontal en movil"
    assert result_scroll["scrollWidth"] > result_scroll["clientWidth"], "La tabla de resultados no excedio el ancho en movil para poder desplazar"
    assert result_scroll["after"] > result_scroll["before"], "La tabla de resultados no permitio desplazamiento horizontal en movil"
    assert result_scroll["overflowX"] in ("auto", "scroll"), "La tabla de resultados no dejo habilitado el overflow horizontal en movil"


def test_npc_party_capacity_and_resources_import(driver, base_url):
    driver.get(f"{base_url}/npcgrandesfiestas/")
    wait_for(driver, "#btnImportParty")

    driver.execute_script(
        "document.getElementById('partyCapacityInput').value = arguments[0];"
        "document.getElementById('partyResourcesInput').value = arguments[1];",
        CAPACITY_EXAMPLE,
        RESOURCES_EXAMPLE
    )
    driver.find_element(By.ID, "btnImportParty").click()

    WebDriverWait(driver, 10).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "#partyVillageBody tr")) == 9
    )

    status = driver.find_element(By.ID, "partyImportStatus").text
    summary_values = [
        item.text.strip()
        for item in driver.find_elements(By.CSS_SELECTOR, "#partySummary .training-summary-value")
    ]
    central_options = Select(driver.find_element(By.ID, "partyCentralVillage")).options
    roles = [
        cell.text.strip()
        for cell in driver.find_elements(By.CSS_SELECTOR, "#partyVillageBody tr td:nth-child(2)")
    ]

    assert "Cruce valido: 9" in status, "NPC grandes fiestas no cruzo correctamente capacidad y recursos"
    assert len(central_options) == 9, "NPC grandes fiestas no lleno las candidatas a aldea central"
    assert summary_values == ["9", "8", "1", "9"], "NPC grandes fiestas no mostro bien el resumen inicial"
    assert roles.count("Central") == 1 and roles.count("Destino") == 8, "NPC grandes fiestas no marco correctamente la central y los destinos"

    row_selects = driver.find_elements(By.CSS_SELECTOR, "#partyVillageBody select")
    assert len(row_selects) == 9, "NPC grandes fiestas no habilito el selector 1/2 por cada aldea importada"
    Select(row_selects[1]).select_by_value("2")
    WebDriverWait(driver, 10).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, "#partySummary .training-summary-value")[3].text.strip() == "10"
    )


def test_npc_party_central_total_and_village_transfers(driver, base_url):
    driver.get(f"{base_url}/npcgrandesfiestas/")
    wait_for(driver, "#btnImportParty")

    result = driver.execute_script(
        """
        const originalRequirement = getPartyRequirementForVillage;
        const originalCounts = buildPartyCountsForVillage;
        try {
          getPartyRequirementForVillage = () => withResourceTotal({ wood: 100, clay: 0, iron: 200, crop: 0 });
          buildPartyCountsForVillage = (village) => [{ label:"GF", troopName:"Grandes fiestas", units: village.partyCount || 1 }];

          const fake = (name, key, current) => ({
            id: key,
            name,
            key,
            sourceOrder: 0,
            partyCount: 1,
            isDelivered: false,
            isExcluded: false,
            warehouseCap: 999999,
            granaryCap: 999999,
            current: withResourceTotal(current),
            hasResources: true
          });

          allVillages = [
            fake("Central", "central", { wood: 1000, clay: 0, iron: 0, crop: 0 }),
            fake("Aldea A", "a", { wood: 300, clay: 0, iron: 0, crop: 0 }),
            fake("Aldea B", "b", { wood: 0, clay: 0, iron: 300, crop: 0 })
          ];
          allVillages[0].sourceOrder = 0;
          allVillages[1].sourceOrder = 1;
          allVillages[2].sourceOrder = 2;
          partyCentralKey = "central";

          const plan = evaluatePartyPlan();
          return {
            feasible: plan.feasible,
            npcTotal: plan.totalTransfer.total,
            npcIron: plan.totalTransfer.iron,
            reserveTotal: plan.centralReserve.total,
            transfers: plan.villageTransfers,
            statuses: plan.villagePlans.map(item => ({ name: item.village.name, status: item.status }))
          };
        } finally {
          getPartyRequirementForVillage = originalRequirement;
          buildPartyCountsForVillage = originalCounts;
        }
        """
    )

    assert result["feasible"], "NPC grandes fiestas no considero la reserva central mas el reparto NPC"
    assert result["reserveTotal"] == 300, "NPC grandes fiestas no reservo correctamente la fiesta propia de la central"
    assert result["npcTotal"] == 300 and result["npcIron"] == 200, "NPC grandes fiestas no dejo solo el faltante real para el NPC central"
    assert len(result["transfers"]) == 0, "NPC grandes fiestas no debia generar envios entre aldeas mientras la central aun alcanzaba"
    assert {item["status"] for item in result["statuses"]} == {"NPC", "Central"}, "NPC grandes fiestas debia usar solo NPC central mientras la central no se agotara"


def test_npc_party_uses_village_transfers_only_after_central_exhausts(driver, base_url):
    driver.get(f"{base_url}/npcgrandesfiestas/")
    wait_for(driver, "#btnImportParty")

    result = driver.execute_script(
        """
        const originalRequirement = getPartyRequirementForVillage;
        const originalCounts = buildPartyCountsForVillage;
        try {
          getPartyRequirementForVillage = () => withResourceTotal({ wood: 100, clay: 0, iron: 200, crop: 0 });
          buildPartyCountsForVillage = (village) => [{ label:"GF", troopName:"Grandes fiestas", units: village.partyCount || 1 }];

          const fake = (name, key, current, order) => ({
            id: key,
            name,
            key,
            sourceOrder: order,
            partyCount: 1,
            isInitialZone: false,
            isDelivered: false,
            isExcluded: false,
            warehouseCap: 999999,
            granaryCap: 999999,
            current: withResourceTotal(current),
            hasResources: true
          });

          allVillages = [
            fake("Central", "central", { wood: 450, clay: 0, iron: 0, crop: 0 }, 0),
            fake("Aldea A", "a", { wood: 300, clay: 0, iron: 0, crop: 0 }, 1),
            fake("Aldea B", "b", { wood: 0, clay: 0, iron: 300, crop: 0 }, 2)
          ];
          partyCentralKey = "central";

          const plan = evaluatePartyPlan();
          return {
            feasible: plan.feasible,
            npcTotal: plan.totalTransfer.total,
            transfers: plan.villageTransfers,
            statuses: plan.villagePlans.map(item => ({ name: item.village.name, status: item.status }))
          };
        } finally {
          getPartyRequirementForVillage = originalRequirement;
          buildPartyCountsForVillage = originalCounts;
        }
        """
    )

    assert result["feasible"], "NPC grandes fiestas debia permitir envios entre aldeas cuando la central ya no cubria todo"
    assert result["npcTotal"] == 150, "NPC grandes fiestas no debia seguir pidiendo mas NPC del que la central podia cubrir tras agotarse"
    assert len(result["transfers"]) == 2, "NPC grandes fiestas debia generar solo el apoyo faltante entre aldeas cuando la central se agotaba"
    assert {item["status"] for item in result["statuses"]} == {"Envio", "Envio + NPC", "Central"}, "NPC grandes fiestas no distinguio correctamente el uso de la central agotada y el apoyo entre aldeas"


def test_npc_party_central_row_can_be_deleted_from_plan(driver, base_url):
    driver.get(f"{base_url}/npcgrandesfiestas/")
    wait_for(driver, "#btnImportParty")

    driver.execute_script(
        """
        const makeVillage = (name, key, sourceOrder) => ({
          id: key,
          name,
          key,
          sourceOrder,
          partyCount: 1,
          isInitialZone: false,
          isDelivered: false,
          isExcluded: false,
          warehouseCap: 999999,
          granaryCap: 999999,
          current: withResourceTotal({ wood: 1000, clay: 1000, iron: 1000, crop: 1000 }),
          hasResources: true
        });

        const central = makeVillage("Central", "central", 0);
        const villageA = makeVillage("Villa A", "a", 1);
        allVillages = [central, villageA];
        partyCentralKey = "central";
        partySplitModeByVillage = {};
        window.__recalcHits = 0;
        window.__originalRecalc = recalc;
        recalc = () => { window.__recalcHits += 1; };

        renderPartyResult({
          feasible: true,
          totalPartyCount: 2,
          totalTransfer: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central: central,
          centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
          centralReserve: withResourceTotal({ wood: 29700, clay: 33250, iron: 32000, crop: 6700 }),
          villagePlans: [
            { village: central, status: "Central", isCentralRow: true, counts: [{ label:"GF", troopName:"Grandes fiestas", units:1 }], deficit: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }) },
            { village: villageA, status: "NPC", counts: [{ label:"GF", troopName:"Grandes fiestas", units:1 }], deficit: withResourceTotal({ wood: 100, clay: 100, iron: 100, crop: 100 }) }
          ]
        });
        """
    )

    driver.find_element(By.CSS_SELECTOR, '.training-row-delete-btn[data-village-key="central"]').click()
    state = driver.execute_script(
        """
        const rowKeys = [...document.querySelectorAll('.training-transfer-table tbody tr')].map(row => row.getAttribute('data-village-key'));
        const restore = window.__originalRecalc;
        const result = {
          rowKeys,
          centralExcluded: allVillages.find(v => v.key === 'central').isExcluded,
          centralKey: partyCentralKey,
          recalcHits: window.__recalcHits
        };
        recalc = restore;
        return result;
        """
    )

    assert state["rowKeys"] == ["central", "a"], "NPC grandes fiestas no mostro la aldea central dentro de la lista inferior del plan"
    assert state["centralExcluded"], "NPC grandes fiestas no permitio borrar la aldea central del plan"
    assert state["centralKey"] == "central", "NPC grandes fiestas no debia cambiar la seleccion de aldea central al borrarla del plan"
    assert state["recalcHits"] == 1, "Borrar la fila central no disparo el recalculo del plan"


def test_npc_party_excludes_initial_zone_villages(driver, base_url):
    driver.get(f"{base_url}/npcgrandesfiestas/")
    wait_for(driver, "#btnImportParty")

    capacity_zi = CAPACITY_EXAMPLE.replace("FO001", "ZI001").replace("FO002", "ZI002")
    resources_zi = RESOURCES_EXAMPLE.replace("FO001", "ZI001").replace("FO002", "ZI002")
    driver.execute_script(
        "document.getElementById('partyCapacityInput').value = arguments[0];"
        "document.getElementById('partyResourcesInput').value = arguments[1];",
        capacity_zi,
        resources_zi
    )
    driver.find_element(By.ID, "btnImportParty").click()

    WebDriverWait(driver, 10).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "#partyVillageBody tr")) == 9
    )

    central_labels = [
        option.text.strip()
        for option in Select(driver.find_element(By.ID, "partyCentralVillage")).options
    ]
    roles = [
        cell.text.strip()
        for cell in driver.find_elements(By.CSS_SELECTOR, "#partyVillageBody tr td:nth-child(2)")
    ]
    summary_values = [
        item.text.strip()
        for item in driver.find_elements(By.CSS_SELECTOR, "#partySummary .training-summary-value")
    ]

    assert not any(label.startswith("ZI") for label in central_labels), "NPC grandes fiestas no excluyo las aldeas ZI de las candidatas a central"
    assert roles.count("Excluida ZI") == 2, "NPC grandes fiestas no marco las aldeas ZI como excluidas del ejercicio"
    assert summary_values == ["9", "6", "1", "7"], "NPC grandes fiestas no desconto las aldeas ZI del ejercicio"


def test_npc_party_split_buttons(driver, base_url):
    driver.get(f"{base_url}/npcgrandesfiestas/")
    wait_for(driver, "#btnImportParty")

    driver.execute_script(
        """
        partySplitModeByVillage = {};
        renderPartyResult({
          feasible: true,
          partyCount: 2,
          totalTransfer: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central: { name: "Central" },
          centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
          centralReserve: withResourceTotal({ wood: 59400, clay: 66500, iron: 64000, crop: 13400 }),
          villagePlans: [{
            village: { key: "villa-a", name: "Villa A" },
            status: "NPC",
            counts: [{ label:"GF", troopName:"Grandes fiestas", units:2 }],
            deficit: withResourceTotal({ wood: 64618, clay: 65521, iron: 83615, crop: 27932 })
          }]
        });
        """
    )

    driver.find_element(By.CSS_SELECTOR, '.split-toggle-btn[data-factor="2"]').click()
    labels_after_2 = [el.text for el in driver.find_elements(By.CSS_SELECTOR, ".split-subvalue")]
    active_after_2 = driver.find_elements(By.CSS_SELECTOR, '.split-toggle-btn.active[data-factor="2"]')
    inactive_3 = driver.find_elements(By.CSS_SELECTOR, '.split-toggle-btn.active[data-factor="3"]')

    driver.find_element(By.CSS_SELECTOR, '.split-toggle-btn[data-factor="3"]').click()
    labels_after_3 = [el.text for el in driver.find_elements(By.CSS_SELECTOR, ".split-subvalue")]
    active_after_3 = driver.find_elements(By.CSS_SELECTOR, '.split-toggle-btn.active[data-factor="3"]')
    inactive_2 = driver.find_elements(By.CSS_SELECTOR, '.split-toggle-btn.active[data-factor="2"]')

    assert any("x2: GF: Grandes fiestas 1" in text for text in labels_after_2), "Entre 2 no dividio la cantidad de fiestas en la segunda linea"
    assert any("x2: 32309" in text for text in labels_after_2), "Entre 2 no dividio los recursos en la segunda linea"
    assert len(active_after_2) == 1 and len(inactive_3) == 0, "Entre 2 no quedo como unico boton activo en grandes fiestas"
    assert any("x3: GF: Grandes fiestas 1" in text for text in labels_after_3), "Entre 3 no mostro la segunda linea de fiestas"
    assert any("x3: 21540" in text for text in labels_after_3), "Entre 3 no dividio los recursos en la segunda linea"
    assert len(active_after_3) == 1 and len(inactive_2) == 0, "Entre 3 no reemplazo correctamente al boton activo en grandes fiestas"


def test_npc_party_total_and_capacity_fit_columns(driver, base_url):
    driver.get(f"{base_url}/npcgrandesfiestas/")
    wait_for(driver, "#btnImportParty")

    result = driver.execute_script(
        """
        const villageA = {
          key: "villa-a",
          name: "Villa A",
          sourceOrder: 0,
          current: withResourceTotal({ wood: 300000, clay: 10000, iron: 5000, crop: 1000 }),
          warehouseCap: 350000,
          granaryCap: 50000
        };
        const villageB = {
          key: "villa-b",
          name: "Villa B",
          sourceOrder: 1,
          current: withResourceTotal({ wood: 330000, clay: 10000, iron: 5000, crop: 49000 }),
          warehouseCap: 350000,
          granaryCap: 50000
        };

        renderPartyResult({
          feasible: true,
          partyCount: 1,
          totalTransfer: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central: { name: "Central" },
          centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
          centralReserve: withResourceTotal({ wood: 29700, clay: 33250, iron: 32000, crop: 6700 }),
          villagePlans: [
            {
              village: villageA,
              status: "NPC",
              counts: [{ label:"GF", troopName:"Grandes fiestas", units:1 }],
              deficit: withResourceTotal({ wood: 40000, clay: 1000, iron: 2000, crop: 1000 })
            },
            {
              village: villageB,
              status: "NPC",
              counts: [{ label:"GF", troopName:"Grandes fiestas", units:1 }],
              deficit: withResourceTotal({ wood: 40000, clay: 2000, iron: 1000, crop: 2000 })
            }
          ]
        });

        const headers = [...document.querySelectorAll('.training-transfer-table thead th')].map(item => item.textContent.trim());
        const totalA = document.querySelector('[data-village-key="villa-a"] td:nth-child(9)').textContent.trim();
        const fitA = document.querySelector('[data-village-key="villa-a"] td:nth-child(10)').textContent.trim();
        const totalB = document.querySelector('[data-village-key="villa-b"] td:nth-child(9)').textContent.trim();
        const fitB = document.querySelector('[data-village-key="villa-b"] td:nth-child(10)').textContent.trim();

        return { headers, totalA, fitA, totalB, fitB };
        """
    )

    assert "Total" in result["headers"], "La matriz de grandes fiestas no agrego la columna Total"
    assert "CALZA?" in result["headers"], "La matriz de grandes fiestas no agrego la columna CALZA?"
    assert result["totalA"].startswith("44000"), "La columna Total no sumo correctamente la primera fila de grandes fiestas"
    assert result["fitA"].startswith("SI"), "CALZA? debia indicar SI cuando el envio entra completo en grandes fiestas"
    assert result["totalB"].startswith("45000"), "La columna Total no sumo correctamente la segunda fila de grandes fiestas"
    assert result["fitB"].startswith("NO"), "CALZA? debia indicar NO cuando el envio supera la capacidad en grandes fiestas"


def test_npc_party_delivered_and_delete_controls(driver, base_url):
    driver.get(f"{base_url}/npcgrandesfiestas/")
    wait_for(driver, "#btnImportParty")

    driver.execute_script(
        """
        const makeVillage = (name, key, sourceOrder) => ({
          id: key,
          name,
          key,
          sourceOrder,
          isDelivered: false,
          isExcluded: false,
          warehouseCap: 999999,
          granaryCap: 999999,
          current: withResourceTotal({ wood: 1000, clay: 1000, iron: 1000, crop: 1000 }),
          hasResources: true
        });

        const central = makeVillage("Central", "central", 0);
        const villageA = makeVillage("Villa A", "a", 1);
        const villageB = makeVillage("Villa B", "b", 2);
        const villageC = makeVillage("Villa C", "c", 3);

        allVillages = [central, villageA, villageB, villageC];
        partyCentralKey = "central";
        partySplitModeByVillage = {};
        window.__recalcHits = 0;
        window.__originalRecalc = recalc;
        recalc = () => { window.__recalcHits += 1; };

        renderPartyResult({
          feasible: true,
          partyCount: 1,
          totalTransfer: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central: { name: "Central" },
          centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
          centralReserve: withResourceTotal({ wood: 29700, clay: 33250, iron: 32000, crop: 6700 }),
          villagePlans: [
            { village: villageA, status: "NPC", counts: [{ label:"GF", troopName:"Grandes fiestas", units:1 }], deficit: withResourceTotal({ wood: 100, clay: 100, iron: 100, crop: 100 }) },
            { village: villageB, status: "Lista", counts: [{ label:"GF", troopName:"Grandes fiestas", units:1 }], deficit: withResourceTotal({ wood: 90, clay: 90, iron: 90, crop: 90 }) },
            { village: villageC, status: "Lista", counts: [{ label:"GF", troopName:"Grandes fiestas", units:1 }], deficit: withResourceTotal({ wood: 80, clay: 80, iron: 80, crop: 80 }) }
          ]
        });
        """
    )

    driver.find_element(By.CSS_SELECTOR, '.training-delivered-check[data-village-key="a"]').click()
    WebDriverWait(driver, 5).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, ".training-transfer-table tbody tr")[-1].get_attribute("data-village-key") == "a"
    )

    delivered_state = driver.execute_script(
        """
        const rows = [...document.querySelectorAll('.training-transfer-table tbody tr')].map(row => ({
          key: row.getAttribute('data-village-key'),
          delivered: row.classList.contains('is-delivered')
        }));
        const deliveredRow = document.querySelector('.training-transfer-row.is-delivered');
        const nameEl = deliveredRow ? deliveredRow.querySelector('.training-village-name') : null;
        const numberEl = deliveredRow ? deliveredRow.querySelector('td:nth-child(5) .split-cell-main') : null;
        return {
          rows,
          excludedBeforeDelete: allVillages.find(v => v.key === 'b').isExcluded,
          nameStyle: nameEl ? window.getComputedStyle(nameEl).textDecorationLine : "",
          numberStyle: numberEl ? window.getComputedStyle(numberEl).textDecorationLine : ""
        };
        """
    )

    driver.find_element(By.CSS_SELECTOR, '.training-row-delete-btn[data-village-key="b"]').click()
    after_delete = driver.execute_script(
        """
        const restore = window.__originalRecalc;
        const state = {
          excluded: allVillages.find(v => v.key === 'b').isExcluded,
          effectiveKeys: getActiveDestinationVillages().map(v => v.key),
          recalcHits: window.__recalcHits
        };
        recalc = restore;
        return state;
        """
    )

    assert [item["key"] for item in delivered_state["rows"]] == ["b", "c", "a"], "La fila entregada no se mando al final en grandes fiestas"
    assert delivered_state["rows"][-1]["delivered"], "La fila entregada no recibio el estilo gris/tachado en grandes fiestas"
    assert delivered_state["nameStyle"] == "line-through", "El nombre de la aldea entregada no quedo tachado en grandes fiestas"
    assert delivered_state["numberStyle"] == "none", "Los valores numericos de la aldea entregada no debian quedar tachados en grandes fiestas"
    assert not delivered_state["excludedBeforeDelete"], "La aldea ya estaba excluida antes de usar la papelera en grandes fiestas"
    assert after_delete["excluded"], "La papelera no marco la aldea como excluida en grandes fiestas"
    assert after_delete["effectiveKeys"] == ["a", "c"], "La papelera no saco la aldea del conjunto usado para el calculo en grandes fiestas"
    assert after_delete["recalcHits"] == 1, "La papelera no disparo el recalculo en grandes fiestas"


def main():
    try:
        driver = build_driver()
    except WebDriverException as exc:
        print(json.dumps({
            "ok": False,
            "error": f"No fue posible iniciar ChromeDriver/Chrome: {exc}"
        }, ensure_ascii=False))
        raise SystemExit(1)

    results = []
    try:
        with local_server() as base_url:
            tests = [
                ("theme", test_theme_toggle),
                ("default_server_speed_x3", test_default_server_speed_x3),
                ("roi", test_roi),
                ("npc", test_npc),
                ("npc_training_capacity_parser", test_npc_training_capacity_parser),
                ("npc_training_capacity_import_without_resources", test_npc_training_capacity_import_without_resources),
                ("npc_training_resources_parser", test_npc_training_resources_parser),
                ("npc_training_capacity_and_resources_import", test_npc_training_capacity_and_resources_import),
                ("npc_training_import_preserves_resource_order", test_npc_training_import_preserves_resource_order),
                ("npc_training_central_total_and_village_transfers", test_npc_training_central_total_and_village_transfers),
                ("npc_training_central_capacity_cap", test_npc_training_central_capacity_cap),
                ("npc_training_npc_central_boxes", test_npc_training_npc_central_boxes),
                ("npc_training_central_overview_cards", test_npc_training_central_overview_cards),
                ("npc_training_split_buttons", test_npc_training_split_buttons),
                ("npc_training_global_modifiers", test_npc_training_global_modifiers),
                ("npc_training_queue_names", test_npc_training_queue_names),
                ("npc_training_resource_icons", test_npc_training_resource_icons),
                ("npc_training_total_and_capacity_fit_columns", test_npc_training_total_and_capacity_fit_columns),
                ("npc_training_delivered_and_delete_controls", test_npc_training_delivered_and_delete_controls),
                ("npc_training_mobile_horizontal_scroll", test_npc_training_mobile_horizontal_scroll),
                ("npc_party_capacity_and_resources_import", test_npc_party_capacity_and_resources_import),
                ("npc_party_central_total_and_village_transfers", test_npc_party_central_total_and_village_transfers),
                ("npc_party_uses_village_transfers_only_after_central_exhausts", test_npc_party_uses_village_transfers_only_after_central_exhausts),
                ("npc_party_excludes_initial_zone_villages", test_npc_party_excludes_initial_zone_villages),
                ("npc_party_central_row_can_be_deleted_from_plan", test_npc_party_central_row_can_be_deleted_from_plan),
                ("npc_party_split_buttons", test_npc_party_split_buttons),
                ("npc_party_total_and_capacity_fit_columns", test_npc_party_total_and_capacity_fit_columns),
                ("npc_party_delivered_and_delete_controls", test_npc_party_delivered_and_delete_controls),
                ("oasis", test_oasis),
                ("vacas", test_vacas),
                ("cultura", test_cultura),
            ]
            selected = {
                item.strip()
                for item in os.environ.get("TEST_FILTER", "").split(",")
                if item.strip()
            }
            if selected:
                tests = [(name, fn) for name, fn in tests if name in selected]
            for name, fn in tests:
                try:
                    fn(driver, base_url)
                    results.append({"test": name, "ok": True})
                except (AssertionError, NoSuchElementException, TimeoutException) as exc:
                    results.append({"test": name, "ok": False, "error": str(exc)})
    finally:
        driver.quit()

    failed = [result for result in results if not result["ok"]]
    print(json.dumps({"ok": not failed, "results": results}, ensure_ascii=False, indent=2))
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
