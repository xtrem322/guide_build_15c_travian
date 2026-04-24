import http.server
import json
import os
import re
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

TRAINING_TIMES_EXAMPLE = """Privacy settings
2
Village overview
Overview
Resources
Culture points
Troops

Training
Village Barracks Stable Workshop Great Barracks
ZI Villa Zero 1:49:12 • • -
ZI 001 • 2:56:20 • -
ZI 002 0:19:28 • • -
Villa Pokemon - - - -
Villa Tormento - - - -
FH Villa Esperanza • • • •
FR Ojitos Rojos 0:16:47 1:14:28 - -
FGA Villa EmociÃ³n 2:02:58 • - -
FGE Villa Charizard 0:03:46 • - -
Team_Tocabolus
Population: 223
Loyalty: 100%
Villages 13/14
"""

TRAINING_TIMES_EXTRA_COLUMNS_EXAMPLE = """Privacy settings
1,471
5,699
160,000
17,004
4,048
69,002
160,000
120,709
9,334
Switch to avatar for sitting
Hero
1
Server time: 5:39:02 (UTC +01:00)
Alliance banner
SAQ 1
Info box
2x

Village overview
Overview
Resources
Culture points
Troops
Training
Village Barracks Stable Workshop Great Barracks Great Stable Great Workshop Hospital
ZI Villa Zero - - 5:10:58 • • - -
ZI 001 - - • 0:49:38 • - -
ZI 002 - - • • • - -
Villa Pokemon - - - - - - -
CE Villa Tormento - - - - - - -
FH Villa Esperanza 0:59:13 0:45:38 7:19:34 6:56:44 1:52:41 • -
FH Ojitos Rojos - - 4:41:11 5:13:01 • • -
Villa Denominathor - - • 2:45:17 - • -
Villa Intercepthor - - • 1:52:45 - • -
FE Villa Emoción - - 4:41:48 4:42:50 - - -
FE Villa Charizard - - 4:41:53 4:42:19 - - -
FE Siempre Fuertes - - 4:41:55 4:41:26 - - -
FGE Villa OnePiece - - 5:02:45 - - - -
FE Taberna Del Pony - - 4:53:45 • - - -
FE Villa Luffy - - 4:47:24 - - - -
Team_Tocabolus
Population: 950
Loyalty: 100%
Villages 15/17
"""

TRAINING_TIMES_NO_HEADER_EXTRA_COLUMNS_EXAMPLE = """Privacy settings
1
1,471
5,699
160,000
46,689
33,444
96,766
160,000
146,295
9,334
Switch to avatar for sitting
Hero
1
Server time: 6:02:27 (UTC +01:00)
Alliance banner
SAQ 1
Info box
2x

Village overview
Overview
Resources
Culture points
Troops
Smithy
Hospital
Training
Village
ZI Villa Zero - - 4:47:34 • • -
ZI 001 - - • 0:26:14 • -
ZI 002 - - • • • -
Villa Pokemon - - - - - -
CE Villa Tormento - - - - - -
FH Villa Esperanza 0:35:49 0:22:14 6:56:10 6:33:20 1:29:17 •
FH Ojitos Rojos - - 4:17:47 4:49:37 • •
Villa Denominathor - - • 2:21:53 - •
Villa Intercepthor - - • 1:29:21 - •
FE Villa Emoción - - 4:18:24 4:19:26 - -
FE Villa Charizard - - 4:18:29 4:18:55 - -
FE Siempre Fuertes - - 4:18:31 4:18:02 - -
FGE Villa OnePiece - - 4:39:21 - - -
FE Taberna Del Pony - - 4:30:21 • - -
FE Villa Luffy - - 4:24:00 - - -
Team_Tocabolus
Population: 956
Loyalty: 100%
Villages 15/17
"""

MAP_SQL_EXAMPLE = """INSERT INTO `vdata` VALUES (32285,'CE Villa Tormento',84,-165,915,17,0,0,0,0,0,0,0,0,0,0);
INSERT INTO `vdata` VALUES (32286,'FH Villa Esperanza',84,-166,915,17,0,0,0,0,0,0,0,0,0,0);
INSERT INTO `vdata` VALUES (32287,'FGA Villa Emoción',84,-164,915,17,0,0,0,0,0,0,0,0,0,0);
INSERT INTO `vdata` VALUES (32288,'FGE Villa Charizard',83,-168,915,17,0,0,0,0,0,0,0,0,0,0);
INSERT INTO `vdata` VALUES (32289,'FR Ojitos Rojos',81,-168,915,17,0,0,0,0,0,0,0,0,0,0);
"""

MAP_SQL_X_WORLD_EXAMPLE = """INSERT INTO `x_world` VALUES (146650,84,-165,6,35068,'Villa Tormento',915,'Team_Tocabolus',17,'SAQ 1',961,NULL,FALSE,NULL,NULL,NULL);
INSERT INTO `x_world` VALUES (147051,84,-166,7,32286,'FH Villa Esperanza',915,'Team_Tocabolus',17,'SAQ 1',982,NULL,FALSE,NULL,NULL,NULL);
INSERT INTO `x_world` VALUES (147049,82,-166,7,39483,'FH Ojitos Rojos',915,'Team_Tocabolus',17,'SAQ 1',740,NULL,FALSE,NULL,NULL,NULL);
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
    paths = ["/roi/", "/npc/", "/npcentrenamiento/", "/planificadorataques/", "/npcgrandesfiestas/", "/oasis/", "/listadevacas/", "/cultura/"]
    for path in paths:
        driver.get(f"{base_url}{path}")
        assert_theme_toggle(driver)


def test_default_server_speed_x3(driver, base_url):
    paths = ["/roi/", "/npc/", "/npcentrenamiento/", "/planificadorataques/", "/oasis/", "/listadevacas/"]
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


def test_npc_party_mode_import_add_row_and_summary(driver, base_url):
    driver.get(f"{base_url}/npc/")
    wait_for(driver, "#excessMode")

    Select(driver.find_element(By.ID, "excessMode")).select_by_value("party")
    wait_for(driver, "#btnImportPartyMode")

    driver.execute_script(
        "document.getElementById('partyCapacityInput').value = arguments[0];"
        "document.getElementById('partyResourcesInput').value = arguments[1];",
        CAPACITY_EXAMPLE,
        RESOURCES_EXAMPLE
    )
    driver.find_element(By.ID, "btnImportPartyMode").click()

    WebDriverWait(driver, 10).until(
        lambda d: "Cruce valido" in d.find_element(By.ID, "partyImportStatus").text
    )

    add_select = Select(driver.find_element(By.ID, "partyRowVillageSelect"))
    add_select.select_by_index(0)
    driver.find_element(By.ID, "btnAddPartyRow").click()

    WebDriverWait(driver, 10).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "#partySelectionBody tr")) == 1
    )

    add_select = Select(driver.find_element(By.ID, "partyRowVillageSelect"))
    add_select.select_by_index(0)
    driver.find_element(By.ID, "btnAddPartyRow").click()

    WebDriverWait(driver, 10).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "#partySelectionBody tr")) == 2
    )

    summary_values = [
        item.text.strip()
        for item in driver.find_elements(By.CSS_SELECTOR, "#partySummary .training-summary-value")
    ]
    result_rows = driver.find_elements(By.CSS_SELECTOR, "#partyResultBody .training-transfer-table tbody tr")

    assert summary_values == ["9", "9", "2", "3"], "El modo combinado de grandes fiestas no mostro el resumen esperado tras añadir filas"
    assert len(result_rows) == 2, "El modo combinado de grandes fiestas no renderizo las aldeas seleccionadas en el plan"


def test_npc_party_mode_result_delete_removes_row(driver, base_url):
    driver.get(f"{base_url}/npc/")
    wait_for(driver, "#excessMode")

    Select(driver.find_element(By.ID, "excessMode")).select_by_value("party")
    wait_for(driver, "#btnImportPartyMode")

    driver.execute_script(
        "document.getElementById('partyCapacityInput').value = arguments[0];"
        "document.getElementById('partyResourcesInput').value = arguments[1];",
        CAPACITY_EXAMPLE,
        RESOURCES_EXAMPLE
    )
    driver.find_element(By.ID, "btnImportPartyMode").click()

    WebDriverWait(driver, 10).until(
        lambda d: "Cruce valido" in d.find_element(By.ID, "partyImportStatus").text
    )

    add_select = Select(driver.find_element(By.ID, "partyRowVillageSelect"))
    add_select.select_by_index(0)
    driver.find_element(By.ID, "btnAddPartyRow").click()

    WebDriverWait(driver, 10).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "#partySelectionBody tr")) == 1
    )

    driver.find_element(By.CSS_SELECTOR, "#partyResultBody .training-row-delete-btn").click()
    WebDriverWait(driver, 10).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "#partySelectionBody tr")) == 0
    )

    status = driver.find_element(By.ID, "statusLine").text
    assert "Añade al menos una aldea destino" in status, "Quitar la ultima fila del modo combinado no devolvio el estado esperado"


def test_npc_party_mode_generates_links_from_manual_map_sql(driver, base_url):
    driver.get(f"{base_url}/npc/")
    wait_for(driver, "#excessMode")

    Select(driver.find_element(By.ID, "excessMode")).select_by_value("party")
    wait_for(driver, "#btnImportPartyMode")

    driver.execute_script(
        """
        partyImportedVillages = [
          {
            name: "Central",
            key: "central",
            sourceOrder: 0,
            warehouseCap: 400000,
            granaryCap: 400000,
            current: withResourceTotal({ wood: 200000, clay: 200000, iron: 200000, crop: 200000 }),
            hasResources: true,
            merchantsAvailable: 20,
            merchantsTotal: 20,
            x: 83,
            y: -166,
            did: 0,
            isInitialZone: false
          },
          {
            name: "Destino",
            key: "destino",
            sourceOrder: 1,
            warehouseCap: 80000,
            granaryCap: 80000,
            current: withResourceTotal({ wood: 1000, clay: 1000, iron: 1000, crop: 1000 }),
            hasResources: true,
            merchantsAvailable: 10,
            merchantsTotal: 10,
            x: 84,
            y: -165,
            did: 0,
            isInitialZone: false
          }
        ];
        partyRowsState = [{ id: 1, villageKey: "destino", partyCount: 1, isDelivered: false }];
        partyRowId = 1;
        partyCentralKey = "central";
        partyCentralCount = 1;
        partyLastImportSummary = "Manual";
        document.getElementById("partyServerHost").value = "example.travian.com";
        document.getElementById("partyMapSqlInput").value = arguments[0];
        document.getElementById("partyCentralRace").value = "GALOS";
        recalc();
        """,
        MAP_SQL_EXAMPLE
    )

    driver.find_element(By.ID, "btnCalculatePartyLinks").click()

    WebDriverWait(driver, 10).until(
        lambda d: "Links generados" in d.find_element(By.ID, "statusLine").text
    )

    link = driver.find_element(By.CSS_SELECTOR, "#partyResultBody .training-link-btn")
    href = link.get_attribute("href")
    did_cell = driver.find_element(By.CSS_SELECTOR, "#partyResultBody .training-links-table tbody tr td:nth-child(3)").text

    assert "did_dest=32285" in href, "El modo combinado de grandes fiestas no uso el did correcto del map.sql manual"
    assert did_cell == "32285", "La tabla de links del modo combinado no mostro el did correcto"


def test_npc_party_mode_detects_siglas_for_central_and_destinations(driver, base_url):
    driver.get(f"{base_url}/npc/")
    wait_for(driver, "#excessMode")

    capacity_party = with_training_prefixes(CAPACITY_EXAMPLE).replace("Villa Pokemon", "CE: Villa Pokemon")
    resources_party = with_training_prefixes(RESOURCES_EXAMPLE).replace("Villa Pokemon", "CE: Villa Pokemon")

    Select(driver.find_element(By.ID, "excessMode")).select_by_value("party")
    wait_for(driver, "#btnImportPartyMode")

    driver.execute_script(
        "document.getElementById('partyCapacityInput').value = arguments[0];"
        "document.getElementById('partyResourcesInput').value = arguments[1];",
        capacity_party,
        resources_party
    )
    driver.find_element(By.ID, "btnImportPartyMode").click()

    WebDriverWait(driver, 10).until(
        lambda d: "Cruce valido" in d.find_element(By.ID, "partyImportStatus").text
    )

    central_text = Select(driver.find_element(By.ID, "partyCentralVillage")).first_selected_option.text
    central_race = Select(driver.find_element(By.ID, "partyCentralRace")).first_selected_option.get_attribute("value")
    destination_options = [
        option.text.strip()
        for option in Select(driver.find_element(By.ID, "partyRowVillageSelect")).options
    ]
    meta_text = driver.find_element(By.ID, "partyCentralMeta").text

    assert central_text.startswith("Villa Pokemon"), "El modo combinado no detecto la aldea central marcada por sigla"
    assert central_race == "EGIPTO", "El modo combinado no tomo la raza central desde la sigla"
    assert len(destination_options) == 4, "El modo combinado no limito los destinos a las aldeas marcadas con siglas de fiestas"
    assert not any(option.startswith("ZI") or option.startswith("FO") for option in destination_options), "El modo combinado no excluyo ZI/aldeas sin sigla del selector de destinos"
    assert "Detectada por sigla CE" in meta_text, "La interfaz no informo que la central fue detectada por sigla"


def test_oasis(driver, base_url):
    driver.get(f"{base_url}/oasis/")
    wait_for(driver, "#btnProcess")
    add_button = driver.find_element(By.CSS_SELECTOR, "#importTroops .btn-add-troop-import")
    add_button.click()
    add_button = driver.find_element(By.CSS_SELECTOR, "#importTroops .btn-add-troop-import")
    add_button.click()

    troop_rows = driver.find_elements(By.CSS_SELECTOR, "#importTroops .import-troop-row")
    assert len(troop_rows) == 3, "Oasis no preparo las tres filas de tropas"

    troop_setup = [
        ("Jinete estepario", "1"),
        ("Jinete certero", "1"),
        ("Merodeador", "1"),
    ]
    for row, (troop_name, qty) in zip(troop_rows, troop_setup):
        Select(row.find_element(By.TAG_NAME, "select")).select_by_visible_text(troop_name)
        qty_input = row.find_element(By.CSS_SELECTOR, "input[type='number']")
        qty_input.clear()
        qty_input.send_keys(qty)

    textarea = driver.find_element(By.ID, "taImport")
    textarea.send_keys("Oasis desocupado 3\n1\n24.2.2026\nOasis desocupado 5.1\n1\n24.2.2026")
    driver.find_element(By.ID, "btnProcess").click()
    rows = driver.find_elements(By.CSS_SELECTOR, "#oasisTableBody .oasis-row")
    assert len(rows) == 2, "Oasis no proceso las filas esperadas"
    assert driver.find_element(By.ID, "globalResult").is_displayed(), "Oasis no mostro resultado global"
    assert driver.find_element(By.ID, "slow-1").text == "Merodeador", "Oasis no detecto la tropa limitante"
    assert driver.find_element(By.ID, "ida-1").text == "04:17", "Oasis no calculo bien la ida de la tropa limitante"
    assert driver.find_element(By.ID, "iv-1").text == "08:34", "Oasis no calculo bien la ida y vuelta"
    assert driver.find_element(By.ID, "grp-1").text == "3", "Oasis no calculo bien los grupos por fila"

    chips = driver.find_elements(By.CSS_SELECTOR, "#globalTroopList .gr-troop-chip")
    chip_values = {
        chip.find_element(By.CLASS_NAME, "gr-troop-name").text:
        chip.find_element(By.CLASS_NAME, "gr-troop-qty").text
        for chip in chips
    }
    assert chip_values == {
        "Merodeador": "7",
        "Jinete estepario": "7",
        "Jinete certero": "7",
    }, "Oasis no calculo bien el pool sincronizado por combo de oasis"
    assert driver.find_element(By.ID, "simulationDetail").is_displayed(), "Oasis no mostro el detalle de la simulacion"
    sim_rows = driver.find_elements(By.CSS_SELECTOR, "#simulationRows .sim-row")
    assert len(sim_rows) >= 3, "Oasis no renderizo suficientes ciclos de simulacion"
    assert "Estable" in sim_rows[-1].text, "Oasis no marco el ciclo estable en el detalle"


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


def test_npc_training_usage_guide(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    titles = [
        item.text.strip()
        for item in driver.find_elements(By.CSS_SELECTOR, ".mode-panel .mode-title")
    ]
    notes = [
        item.text.strip()
        for item in driver.find_elements(By.CSS_SELECTOR, ".mode-panel .training-note")
    ]

    assert "Instructivo de uso" in titles, "NPC entrenamiento no mostro el bloque instructivo al final"
    assert any("FGE" in note and "germano" in note.lower() for note in notes), "NPC entrenamiento no incluyo la referencia de siglas de raza en el instructivo"


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


def test_npc_training_default_building_levels_start_at_20(driver, base_url):
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

    first_row_values = driver.execute_script(
        """
        const row = document.querySelector('#trainingVillageBody tr');
        const selects = row ? [...row.querySelectorAll('select.training-level-select')] : [];
        return selects.slice(0, 3).map(item => item.value);
        """
    )

    assert first_row_values == ["20", "20", "20"], "NPC entrenamiento no dejo los niveles de cuartel, establo y taller en 20 por defecto"


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
    assert result["npcTotal"] == 500 and result["npcWood"] == 300 and result["npcIron"] == 200, "NPC entrenamiento no dejo el faltante completo sobre la central cuando ella sola alcanzaba"
    assert len(result["transfers"]) == 0, "NPC entrenamiento no debia generar envios entre aldeas mientras la central aun alcanzaba"
    assert {item["status"] for item in result["statuses"]} == {"NPC"}, "NPC entrenamiento debia usar solo NPC central mientras la central no se agotara"


def test_npc_training_uses_village_transfers_only_after_central_exhausts(driver, base_url):
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
            fake("Central", "central", { wood: 150, clay: 0, iron: 0, crop: 0 }, false),
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

    assert result["feasible"], "NPC entrenamiento debia permitir apoyo entre aldeas cuando la central ya no cubria todo"
    assert result["npcTotal"] == 150, "NPC entrenamiento no debia seguir pidiendo mas NPC del que la central podia cubrir tras agotarse"
    assert len(result["transfers"]) == 2, "NPC entrenamiento debia generar apoyo entre aldeas solo cuando la central se agotaba"
    assert {item["status"] for item in result["statuses"]} == {"Envio + NPC"}, "NPC entrenamiento no distinguio correctamente el uso de la central agotada y el apoyo entre aldeas"


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


def test_npc_training_finds_lower_target_when_equalized_base_does_not_fit(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_script(
        """
        const originalGetTrainingRequirement = getTrainingRequirement;
        const originalBuildTrainingQueues = buildTrainingQueues;
        const originalGetQueueCurrentTrainingSec = getQueueCurrentTrainingSec;
        const originalIsEqualTrainingTimeModeEnabled = isEqualTrainingTimeModeEnabled;
        try {
          const fake = (name, key, current, isTraining, warehouseCap, granaryCap, currentQueueSec) => ({
            id: key,
            name,
            key,
            sourceOrder: 0,
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
            helmetStable: 0,
            currentTrainingByQueue: withTrainingQueueTimes({ C: currentQueueSec, E: 0, T: 0 }),
            currentTrainingSec: currentQueueSec
          });

          allVillages = [
            fake("Central", "central", { wood: 1000, clay: 1000, iron: 1000, crop: 1000 }, false, 300, 800, 0),
            fake("FR Aldea A", "a", { wood: 0, clay: 0, iron: 0, crop: 0 }, true, 999999, 999999, 600),
            fake("FR Aldea B", "b", { wood: 0, clay: 0, iron: 0, crop: 0 }, true, 999999, 999999, 0)
          ];
          trainingVillages = allVillages.filter(v => v.isTraining);
          trainingCentralKey = "central";

          isEqualTrainingTimeModeEnabled = () => true;
          buildTrainingQueues = () => [{ label:"C" }];
          getQueueCurrentTrainingSec = (village) => village.key === "a" ? 600 : 0;
          getTrainingRequirement = (village, targetSec) => {
            const requested = village.key === "a"
              ? Math.max(0, targetSec - 600)
              : Math.max(0, targetSec);
            return {
              queues:[{label:"C"}],
              counts:[{label:"C", units: requested}],
              resources: withResourceTotal({ wood: requested, clay: 0, iron: 0, crop: 0 }),
              currentTrainingByQueue: withTrainingQueueTimes({ C: village.key === "a" ? 600 : 0, E: 0, T: 0 }),
              requestedTrainingByQueue: withTrainingQueueTimes({ C: requested, E: 0, T: 0 }),
              maxCurrentSec: village.key === "a" ? 600 : 0,
              maxRequestedSec: requested
            };
          };

          const plan = findBestTrainingPlan();
          return {
            feasible: plan.feasible,
            targetSec: plan.targetSec,
            totalWood: plan.totalTransfer?.wood || 0
          };
        } finally {
          getTrainingRequirement = originalGetTrainingRequirement;
          buildTrainingQueues = originalBuildTrainingQueues;
          getQueueCurrentTrainingSec = originalGetQueueCurrentTrainingSec;
          isEqualTrainingTimeModeEnabled = originalIsEqualTrainingTimeModeEnabled;
        }
        """
    )

    assert result["feasible"], "NPC entrenamiento debia bajar el tiempo objetivo cuando el minimo por igualacion no calzaba"
    assert result["targetSec"] == 300, "NPC entrenamiento no encontro el mayor tiempo objetivo que si cabia en la central"
    assert result["totalWood"] == 300, "NPC entrenamiento no ajusto el NPC total al nuevo tiempo objetivo reducido"


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
        lambda d: len(d.find_elements(By.CSS_SELECTOR, ".training-central-card")) == 6
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
        "MERCADERES",
        "RAZA / MAPA",
    ], "La seccion de aldea central no quedo separada en bloques entendibles"
    assert values[0] == "Villa Tormento", "La tarjeta principal de aldea central no mostro la aldea seleccionada"
    assert values[3] == "946460", "La tarjeta de total disponible no mostro la suma de recursos de la central"
    assert values[4] == "20 / 20", "La tarjeta de mercaderes no mostro disponibles y total de la central"


def test_npc_training_detects_prefixed_central_and_market_controls(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    capacity_training = with_training_prefixes(CAPACITY_EXAMPLE).replace("Villa Tormento", "CE: Villa Tormento")
    resources_training = with_training_prefixes(RESOURCES_EXAMPLE).replace("Villa Tormento", "CE: Villa Tormento")
    driver.execute_script(
        "document.getElementById('trainingCapacityInput').value = arguments[0];"
        "document.getElementById('trainingResourcesInput').value = arguments[1];",
        capacity_training,
        resources_training
    )
    driver.find_element(By.ID, "btnImportTraining").click()

    central_select = Select(driver.find_element(By.ID, "trainingCentralVillage"))
    central_options = [option.text.strip() for option in central_select.options]
    selected_text = central_select.first_selected_option.text.strip()
    market_options = [option.text.strip() for option in Select(driver.find_element(By.ID, "globalMarketBonus")).options]
    lead_minutes = driver.find_element(By.ID, "trainingLinkLeadMinutes").get_attribute("value")
    marketplace_level = Select(driver.find_element(By.ID, "trainingMarketplaceLevel")).first_selected_option.text.strip()
    office_level = Select(driver.find_element(By.ID, "trainingTradeOfficeLevel")).first_selected_option.text.strip()
    central_meta = driver.find_element(By.ID, "trainingCentralMeta").text
    destination_cap_enabled = driver.find_element(By.ID, "useDestinationCapacityCap").is_selected()

    assert central_options == ["[Central] Villa Tormento - Total 946460"], "Si hay centrales detectadas, el combo no debe listar aldeas normales"
    assert selected_text.startswith("[Central] Villa Tormento"), "NPC entrenamiento no auto selecciono la central marcada con prefijo C"
    assert market_options == ["0%", "30%", "60%", "90%", "120%", "150%"], "NPC entrenamiento no agrego las opciones del bono de mercado"
    assert lead_minutes == "1", "El tiempo extra inicial de links debia empezar en 1 minuto"
    assert marketplace_level == "20", "El nivel de mercado no debia iniciar distinto de 20"
    assert office_level == "20", "La oficina de comercio no debia iniciar en nivel 20"
    assert not destination_cap_enabled, "Usar tope almacen Aldea destino? debia iniciar en NO"
    assert "EGIPTO" in central_meta, "NPC entrenamiento no mostro la raza de la central detectada"
    assert "(84|-165)" in central_meta, "NPC entrenamiento no mostro las coordenadas parseadas de la central"


def test_npc_training_equalize_times_toggle_and_parser(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    assert not driver.find_element(By.ID, "trainingTimesWrap").is_displayed(), "El bloque de Training no debia mostrarse antes del check"

    driver.find_element(By.ID, "equalizeTrainingTimes").click()
    WebDriverWait(driver, 10).until(lambda d: d.find_element(By.ID, "trainingTimesWrap").is_displayed())

    parsed = driver.execute_script(
        """
        return parseTrainingTimesTable(arguments[0]).map(row => ({
          name: row.name,
          key: row.key,
          sec: row.currentTrainingSec,
          queues: row.currentTrainingByQueue
        }));
        """,
        TRAINING_TIMES_EXAMPLE
    )

    parsed_by_key = {item["key"]: item for item in parsed}

    assert parsed_by_key["fh villa esperanza"]["sec"] == 0, "El parser de Training no tomo los puntos como tiempo cero"
    assert parsed_by_key["fr ojitos rojos"]["queues"] == {"C": 1007, "E": 4468, "T": 0, "G": 0}, "El parser de Training no separo correctamente cuartel y establo"
    assert parsed_by_key["fga villa emocion"]["queues"] == {"C": 7378, "E": 0, "T": 0, "G": 0}, "El parser de Training no reconocio correctamente el tiempo del cuartel"
    assert parsed_by_key["fge villa charizard"]["queues"] == {"C": 226, "E": 0, "T": 0, "G": 0}, "El parser de Training no reconocio correctamente un tiempo corto"


def test_npc_training_ignores_great_buildings_and_hospital(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    parsed = driver.execute_script(
        """
        return parseTrainingTimesTable(arguments[0]).map(row => ({
          name: row.name,
          key: row.key,
          sec: row.currentTrainingSec,
          queues: row.currentTrainingByQueue
        }));
        """,
        TRAINING_TIMES_EXTRA_COLUMNS_EXAMPLE
    )

    parsed_by_key = {item["key"]: item for item in parsed}

    assert parsed_by_key["fh villa esperanza"]["queues"] == {"C": 3553, "E": 2738, "T": 26374, "G": 0}, "El parser debia tomar solo cuartel, establo y taller"
    assert parsed_by_key["fh villa esperanza"]["sec"] == 32665, "El tiempo total debia ignorar gran cuartel, gran establo y hospital"
    assert parsed_by_key["fh ojitos rojos"]["queues"] == {"C": 0, "E": 0, "T": 16871, "G": 0}, "El parser no debia interpretar gran cuartel como cuartel"
    assert parsed_by_key["fe villa emocion"]["queues"] == {"C": 0, "E": 0, "T": 16908, "G": 0}, "El parser debia conservar el taller aunque existan columnas extra"
    assert parsed_by_key["zi 001"]["sec"] == 0, "El tiempo actual no debia usar el gran cuartel cuando cuartel y establo estan vacios"


def test_npc_training_without_header_uses_last_four_columns(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    parsed = driver.execute_script(
        """
        return parseTrainingTimesTable(arguments[0]).map(row => ({
          name: row.name,
          key: row.key,
          sec: row.currentTrainingSec,
          queues: row.currentTrainingByQueue
        }));
        """,
        TRAINING_TIMES_NO_HEADER_EXTRA_COLUMNS_EXAMPLE
    )

    parsed_by_key = {item["key"]: item for item in parsed}

    assert parsed_by_key["fh villa esperanza"]["name"] == "FH Villa Esperanza", "Sin cabecera completa, el nombre de la aldea no debia contaminarse con tiempos"
    assert parsed_by_key["fh villa esperanza"]["queues"] == {"C": 24970, "E": 23600, "T": 5357, "G": 0}, "Sin cabecera completa, el parser debia usar las ultimas cuatro columnas como base"
    assert parsed_by_key["fh villa esperanza"]["sec"] == 53927, "El tiempo total debia salir de cuartel, establo y taller"
    assert parsed_by_key["zi 001"]["queues"] == {"C": 0, "E": 1574, "T": 0, "G": 0}, "Sin cabecera completa, una sola columna extra inicial debia ignorarse"


def test_npc_training_without_header_uses_last_four_values(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    parsed = driver.execute_script(
        """
        return parseTrainingTimesTable(arguments[0]).map(row => ({
          name: row.name,
          key: row.key,
          sec: row.currentTrainingSec,
          queues: row.currentTrainingByQueue
        }));
        """,
        """Training
Village
Alpha 1:00:00 2:00:00 3:00:00 4:00:00
Beta 0:10:00 1:00:00 2:00:00 3:00:00 4:00:00
Gamma 0:05:00 0:10:00 1:00:00 2:00:00 3:00:00 4:00:00
Population: 1
"""
    )

    parsed_by_key = {item["key"]: item for item in parsed}

    assert parsed_by_key["alpha"]["queues"] == {"C": 3600, "E": 7200, "T": 10800, "G": 0}, "Con 4 valores, el orden debia ser cuartel, establo, taller, hospital"
    assert parsed_by_key["beta"]["queues"] == {"C": 3600, "E": 7200, "T": 10800, "G": 0}, "Con 5 valores, la primera columna debia ignorarse como gran edificio"
    assert parsed_by_key["gamma"]["queues"] == {"C": 3600, "E": 7200, "T": 10800, "G": 0}, "Con 6 valores, las dos primeras columnas debian ignorarse como grandes edificios"


def test_npc_training_equalizes_current_plus_new_time(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_script(
        """
        const originalBuildTrainingQueues = buildTrainingQueues;
        const checkbox = document.getElementById('equalizeTrainingTimes');
        const previousChecked = checkbox.checked;
        try {
          checkbox.checked = true;

          const village = {
            id: "a",
            name: "FR Aldea A",
            key: "a",
            race: "ROMANO",
            raceSupported: true,
            isTraining: true,
            warehouseCap: 999999,
            granaryCap: 999999,
            current: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
            currentTrainingSec: 180,
            currentTrainingByQueue: { C: 120, E: 0, T: 60, G: 0 },
            hasResources: true,
            barracksTroop: "Inf",
            stableTroop: "Cab",
            workshopTroop: "Arma",
            barracksLvl: 1,
            stableLvl: 1,
            workshopLvl: 1,
            allyBonus: 0,
            trooperBoost: 0,
            helmetBarracks: 0,
            helmetStable: 0,
            isDelivered: false,
            isExcluded: false
          };

          buildTrainingQueues = () => ([
            { label:"C", troopName:"Inf", secEach: 1, cost: withResourceTotal({ wood: 1, clay: 0, iron: 0, crop: 0 }) },
            { label:"E", troopName:"Cab", secEach: 1, cost: withResourceTotal({ wood: 1, clay: 0, iron: 0, crop: 0 }) },
            { label:"T", troopName:"Arma", secEach: 1, cost: withResourceTotal({ wood: 1, clay: 0, iron: 0, crop: 0 }) }
          ]);

          const req = getTrainingRequirement(village, 240);
          const counts = Object.fromEntries(req.counts.map(item => [item.label, {
            units: item.units,
            currentSec: item.currentSec,
            requestedSec: item.requestedSec,
            finalSec: item.finalSec
          }]));

          return {
            npcTotal: req.resources.total,
            counts
          };
        } finally {
          buildTrainingQueues = originalBuildTrainingQueues;
          checkbox.checked = previousChecked;
        }
        """
    )

    assert result["npcTotal"] == 540, "NPC entrenamiento no sumo correctamente el tiempo nuevo por edificio activo"
    assert result["counts"]["C"] == {"units": 120, "currentSec": 120, "requestedSec": 120, "finalSec": 240}, "El cuartel no se igualo contra su tiempo vigente"
    assert result["counts"]["E"] == {"units": 240, "currentSec": 0, "requestedSec": 240, "finalSec": 240}, "El establo no se igualo correctamente desde cero"
    assert result["counts"]["T"] == {"units": 180, "currentSec": 60, "requestedSec": 180, "finalSec": 240}, "El taller no se igualo correctamente con su propio tiempo vigente"


def test_npc_training_equalize_times_requires_training_block(driver, base_url):
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

    driver.find_element(By.ID, "equalizeTrainingTimes").click()

    WebDriverWait(driver, 10).until(
        lambda d: "Marca Igualar Tiempos" in d.find_element(By.ID, "statusLine").text
    )

    assert not driver.find_element(By.ID, "trainingResultWrap").is_displayed(), "No debia mostrarse un plan si el bloque Training aun no se habia pegado"


def test_npc_training_equalize_times_matches_training_names_without_colon(driver, base_url):
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

    driver.find_element(By.ID, "equalizeTrainingTimes").click()
    driver.execute_script(
        "document.getElementById('trainingTimesInput').value = arguments[0];"
        "document.getElementById('trainingTimesInput').dispatchEvent(new Event('input', { bubbles: true }));",
        TRAINING_TIMES_EXAMPLE
    )

    WebDriverWait(driver, 10).until(
        lambda d: "Configura al menos una cola de entrenamiento." in d.find_element(By.ID, "statusLine").text
    )

    assert "Faltan tiempos vigentes" not in driver.find_element(By.ID, "statusLine").text, "NPC entrenamiento no cruzo correctamente nombres con y sin dos puntos en el modo Igualar Tiempos"


def test_npc_training_equalize_times_ignores_unconfigured_buildings(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_script(
        """
        const originalBuildTrainingQueues = buildTrainingQueues;
        const checkbox = document.getElementById('equalizeTrainingTimes');
        const previousChecked = checkbox.checked;
        try {
          checkbox.checked = true;

          const village = {
            id: "a",
            name: "FR Aldea A",
            key: "a",
            race: "ROMANO",
            raceSupported: true,
            isTraining: true,
            warehouseCap: 999999,
            granaryCap: 999999,
            current: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
            currentTrainingSec: 3720,
            currentTrainingByQueue: { C: 120, E: 3600, T: 0, G: 0 },
            hasResources: true,
            barracksTroop: "Inf",
            stableTroop: "",
            workshopTroop: "",
            barracksLvl: 1,
            stableLvl: 1,
            workshopLvl: 1,
            allyBonus: 0,
            trooperBoost: 0,
            helmetBarracks: 0,
            helmetStable: 0,
            isDelivered: false,
            isExcluded: false
          };

          buildTrainingQueues = () => ([
            { label:"C", troopName:"Inf", secEach: 1, cost: withResourceTotal({ wood: 1, clay: 0, iron: 0, crop: 0 }) }
          ]);

          const req = getTrainingRequirement(village, 240);
          return {
            npcTotal: req.resources.total,
            counts: req.counts
          };
        } finally {
          buildTrainingQueues = originalBuildTrainingQueues;
          checkbox.checked = previousChecked;
        }
        """
    )

    assert result["npcTotal"] == 120, "NPC entrenamiento tomo en cuenta edificios no configurados al igualar tiempos"
    assert result["counts"] == [{
        "label": "C",
        "troopName": "Inf",
        "units": 120,
        "currentSec": 120,
        "requestedSec": 120,
        "finalSec": 240
    }], "NPC entrenamiento no debio usar el tiempo viejo del establo si esa cola no estaba configurada"


def test_npc_training_split_buttons(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    driver.execute_script(
        """
        trainingSplitModeByVillage = {};
        trainingLastGeneratedLinks = [];
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

    assert driver.find_element(By.ID, "btnCalculateTrainingLinks").is_displayed(), "El boton Calcular links no se renderizo dentro del plan"
    assert driver.find_element(By.ID, "btnOpenAllTrainingLinks").is_displayed(), "El boton Abrir todo no se renderizo dentro del plan"
    assert driver.find_element(By.CSS_SELECTOR, ".training-result-actions #useDestinationCapacityCap").is_displayed(), "El checkbox de tope por aldea destino no quedo junto a los botones del plan"

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


def test_npc_training_copy_distribution_uses_configured_village_order(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        window.__copiedTrainingText = "";
        const originalClipboard = navigator.clipboard;
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text) => {
              window.__copiedTrainingText = text;
            }
          }
        });

        trainingSplitModeByVillage = { "village-b": 2 };
        trainingLastGeneratedLinks = [];

        const villageA = { key: "village-a", name: "Villa A", sourceOrder: 2 };
        const villageB = { key: "village-b", name: "Villa B", sourceOrder: 1 };

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
              counts: [{ label:"E", troopName:"Equites", units:40 }],
              deficit: withResourceTotal({ wood: 100, clay: 100, iron: 100, crop: 100 })
            },
            {
              village: villageB,
              status: "NPC",
              currentTime: 0,
              counts: [{ label:"C", troopName:"Imperiano", units:30 }],
              deficit: withResourceTotal({ wood: 90, clay: 90, iron: 90, crop: 90 })
            }
          ]
        });

        document.getElementById("btnCopyTrainingDistribution").click();

        setTimeout(() => {
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: originalClipboard
          });
          done({
            copied: window.__copiedTrainingText,
            status: document.getElementById("statusLine").textContent.trim(),
            actionTexts: [...document.querySelectorAll('.training-result-actions .btn, .training-result-actions label span')].map(el => el.textContent.trim())
          });
        }, 50);
        """
    )

    assert "Copiar Distribucion de tropas" in result["actionTexts"], "Falto el boton para copiar la distribucion desde las acciones del plan"
    assert result["copied"].startswith("[b]Distribucion de tropas[/b]"), "El resumen copiado debia arrancar con un titulo en negrita"
    assert result["copied"].index("[b]Villa B[/b]") < result["copied"].index("[b]Villa A[/b]"), "El resumen copiado no respeto el orden configurado de aldeas"
    assert "C: Imperiano 30" in result["copied"], "El resumen copiado no incluyo las tropas de la primera aldea configurada"
    assert "x2 por aldea:" in result["copied"] and "C: Imperiano 15" in result["copied"], "El resumen copiado no reflejo el reparto Entre 2"
    assert "E: Equites 40" in result["copied"], "El resumen copiado no incluyo las tropas de la segunda aldea"
    assert "copiado al portapapeles" in result["status"], "La interfaz no confirmo que el resumen se copio"


def test_npc_training_copy_distribution_table_uses_columns_and_village_order(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        window.__copiedTrainingTableText = "";
        const originalClipboard = navigator.clipboard;
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text) => {
              window.__copiedTrainingTableText = text;
            }
          }
        });

        trainingSplitModeByVillage = { "village-b": 2 };
        trainingLastGeneratedLinks = [];

        const villageA = { key: "village-a", name: "Villa A", sourceOrder: 2 };
        const villageB = { key: "village-b", name: "Villa B", sourceOrder: 1 };

        renderTrainingResult({
          feasible: true,
          targetSec: 120,
          totalTransfer: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central: { name: "Central" },
          centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
          activeQueues: 3,
          villagePlans: [
            {
              village: villageA,
              status: "NPC",
              currentTime: 0,
              counts: [
                { label:"E", troopName:"Equites", units:40 },
                { label:"T", troopName:"Ariete", units:12 }
              ],
              deficit: withResourceTotal({ wood: 100, clay: 100, iron: 100, crop: 100 })
            },
            {
              village: villageB,
              status: "NPC",
              currentTime: 0,
              counts: [{ label:"C", troopName:"Imperiano", units:30 }],
              deficit: withResourceTotal({ wood: 90, clay: 90, iron: 90, crop: 90 })
            }
          ]
        });

        document.getElementById("btnCopyTrainingDistributionTable").click();

        setTimeout(() => {
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: originalClipboard
          });
          done({
            copied: window.__copiedTrainingTableText,
            status: document.getElementById("statusLine").textContent.trim(),
            actionTexts: [...document.querySelectorAll('.training-result-actions .btn, .training-result-actions label span')].map(el => el.textContent.trim())
          });
        }, 50);
        """
    )

    lines = result["copied"].splitlines()
    columns = [re.split(r"\s{2,}", line.strip()) for line in lines[2:5]]
    assert "Copiar Distribucion de tropas" in result["actionTexts"], "El boton original de copiar distribucion no debia desaparecer"
    assert "COPIAR DISTRIBUCION FORMATO TABLA" in result["actionTexts"], "Falto el boton nuevo para copiar en formato tabla"
    assert lines[0] == "[b]Distribucion de tropas - formato tabla[/b]", "El resumen tabulado debia arrancar con el titulo correcto"
    assert lines[1] == "[code]" and lines[-1] == "[/code]", "El resumen tabulado debia proteger el espaciado con bloque code"
    assert columns[0] == ["ALDEA", "CUARTEL", "ESTABLO", "TALLER"], "El resumen tabulado no incluyo las columnas esperadas"
    assert columns[1] == ["Villa B", "Imperiano: 30 (x2: Imperiano: 15)", "-", "-"], "La primera fila tabulada no respeto el orden configurado ni el contenido de CUARTEL"
    assert columns[2] == ["Villa A", "-", "Equites: 40", "Ariete: 12"], "La segunda fila tabulada no distribuyo bien ESTABLO y TALLER"
    assert "tabulado" in result["status"].lower() and "copiado al portapapeles" in result["status"].lower(), "La interfaz no confirmo que el resumen tabulado se copio"


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


def test_npc_training_destination_capacity_mode_uses_only_central_and_keeps_optimizing(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_script(
        """
        const originalGetTrainingRequirement = getTrainingRequirement;
        const originalFindVillageCurrentTime = findVillageCurrentTime;
        const previousMode = trainingGlobalConfig.useDestinationCapacityCap;
        try {
          const fake = (name, key, current, isTraining, warehouseCap, granaryCap, sourceOrder) => ({
            id: key,
            name,
            key,
            sourceOrder,
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

          trainingGlobalConfig.useDestinationCapacityCap = true;
          allVillages = [
            fake("Central", "central", { wood: 500, clay: 0, iron: 0, crop: 0 }, false, 999999, 999999, 0),
            fake("FR Aldea A", "a", { wood: 0, clay: 0, iron: 0, crop: 0 }, true, 100, 999999, 1),
            fake("FR Aldea B", "b", { wood: 0, clay: 0, iron: 0, crop: 0 }, true, 999999, 999999, 2)
          ];
          trainingVillages = allVillages.filter(v => v.isTraining);
          trainingCentralKey = "central";

          getTrainingRequirement = (village, targetSec) => {
            if(village.key === "a" || village.key === "b"){
              return {
                queues: [{ label:"C" }],
                counts: [{ label:"C", troopName:"Imperiano", units: Math.max(0, targetSec) }],
                resources: withResourceTotal({ wood: Math.max(0, targetSec), clay: 0, iron: 0, crop: 0 }),
                currentTrainingByQueue: withTrainingQueueTimes({ C: 0, E: 0, T: 0 }),
                requestedTrainingByQueue: withTrainingQueueTimes({ C: Math.max(0, targetSec), E: 0, T: 0 }),
                maxCurrentSec: 0,
                maxRequestedSec: Math.max(0, targetSec)
              };
            }
            return {
              queues: [],
              counts: [],
              resources: zeroResources(),
              currentTrainingByQueue: zeroTrainingQueueTimes(),
              requestedTrainingByQueue: zeroTrainingQueueTimes(),
              maxCurrentSec: 0,
              maxRequestedSec: 0
            };
          };
          findVillageCurrentTime = () => 0;

          const plan = findBestTrainingPlan();
          return {
            feasible: plan.feasible,
            totalWood: plan.totalTransfer.wood,
            transferCount: plan.villageTransfers.length,
            usesDestinationCapacityCap: Boolean(plan.usesDestinationCapacityCap),
            targets: plan.villagePlans.map(item => ({
              key: item.village.key,
              targetSec: item.totalTargetSec,
              wood: item.deficit.wood,
              capped: Boolean(item.cappedByDestination)
            }))
          };
        } finally {
          getTrainingRequirement = originalGetTrainingRequirement;
          findVillageCurrentTime = originalFindVillageCurrentTime;
          trainingGlobalConfig.useDestinationCapacityCap = previousMode;
        }
        """
    )

    by_key = {item["key"]: item for item in result["targets"]}
    assert result["feasible"], "Con tope de destino, NPC entrenamiento debia seguir encontrando un plan valido"
    assert result["usesDestinationCapacityCap"], "El plan no marco que estaba usando el modo de tope en aldea destino"
    assert result["transferCount"] == 0, "Con tope de destino activo no debian existir envios entre aldeas"
    assert result["totalWood"] == 500, "Con tope de destino activo debia seguir agotando la madera disponible en la central"
    assert by_key["a"]["targetSec"] == 100 and by_key["a"]["wood"] == 100 and by_key["a"]["capped"], "La aldea limitada por almacen no quedo capada al tope correcto"
    assert by_key["b"]["targetSec"] == 400 and by_key["b"]["wood"] == 400, "La otra aldea no siguio optimizando el tiempo con el sobrante de la central"


def test_npc_training_capacity_fit_column_is_forced_to_yes_in_destination_cap_mode(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_script(
        """
        trainingGlobalConfig.useDestinationCapacityCap = true;
        const villageA = {
          key: "villa-a",
          name: "Villa A",
          sourceOrder: 0,
          current: withResourceTotal({ wood: 330000, clay: 10000, iron: 5000, crop: 49000 }),
          warehouseCap: 350000,
          granaryCap: 50000
        };

        renderTrainingResult({
          feasible: true,
          usesDestinationCapacityCap: true,
          targetSec: 120,
          totalTransfer: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central: { name: "Central" },
          centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
          activeQueues: 1,
          villagePlans: [
            {
              village: villageA,
              status: "NPC",
              currentTime: 0,
              totalTargetSec: 60,
              counts: [{ label:"C", troopName:"Imperiano", units:100 }],
              deficit: withResourceTotal({ wood: 40000, clay: 2000, iron: 1000, crop: 2000 }),
              cappedByDestination: true
            }
          ]
        });

        return {
          fit: document.querySelector('[data-village-key="villa-a"] td:nth-child(11)').textContent.trim()
        };
        """
    )

    assert result["fit"].startswith("SI"), "Con tope de destino activo, CALZA? debia mostrarse siempre en SI"
    assert "Tope destino aplicado" in result["fit"], "La matriz debia explicar que la aldea estaba limitada por su tope de almacen/granero"


def test_npc_training_generates_trade_links_from_map_sql(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_async_script(
        """
        const mapSql = arguments[0];
        const done = arguments[arguments.length - 1];
        const originalFetch = window.fetch;
        const originalOpen = window.open;
        const originalGetServerTimeFromLocal = getServerTimeFromLocal;
        const OriginalDate = Date;
        window.__opened = [];
        window.fetch = async (url) => ({
          ok: String(url).includes("/map.sql"),
          text: async () => mapSql
        });
        window.open = (url) => {
          window.__opened.push(url || "preview");
          return {
            document: {
              write(){},
              close(){}
            }
          };
        };
        Date = class extends OriginalDate {
          constructor(...args){
            if(args.length){
              super(...args);
            } else {
              super("2026-04-12T05:58:00Z");
            }
          }
          static now(){
            return new OriginalDate("2026-04-12T05:58:00Z").getTime();
          }
        };
        getServerTimeFromLocal = (date) => new OriginalDate(date.getTime() + 6 * 3600000);

        document.getElementById("serverSpeed").value = "1";
        document.getElementById("globalMarketBonus").value = "0.30";
        document.getElementById("trainingServerHost").value = "eternos.x3.hispano.travian.com";
        document.getElementById("trainingTradeOfficeEnabled").checked = true;
        document.getElementById("trainingTradeOfficeLevel").value = "20";
        syncGlobalTrainingConfigFromDom();

        const central = {
          id: "central",
          name: "Villa Tormento",
          key: "central",
          sourceOrder: 0,
          race: "EGIPTO",
          raceSupported: true,
          isTraining: false,
          isCentral: true,
          x: 84,
          y: -165,
          warehouseCap: 400000,
          granaryCap: 880000,
          current: withResourceTotal({ wood: 100000, clay: 100000, iron: 100000, crop: 100000 }),
          merchantsAvailable: 2,
          merchantsTotal: 2,
          hasResources: true
        };
        const villageNear = {
          id: "near",
          name: "Villa Esperanza",
          key: "near",
          sourceOrder: 1,
          race: "HUNOS",
          raceSupported: true,
          isTraining: true,
          isCentral: false,
          x: 84,
          y: -166,
          did: 0,
          warehouseCap: 10000,
          granaryCap: 10000,
          current: withResourceTotal({ wood: 1000, clay: 0, iron: 0, crop: 0 }),
          merchantsAvailable: 0,
          merchantsTotal: 0,
          hasResources: true
        };
        const villageFar = {
          id: "far",
          name: "Ojitos Rojos",
          key: "far",
          sourceOrder: 2,
          race: "ROMANO",
          raceSupported: true,
          isTraining: true,
          isCentral: false,
          x: 81,
          y: -168,
          did: 0,
          warehouseCap: 10000,
          granaryCap: 10000,
          current: withResourceTotal({ wood: 9000, clay: 0, iron: 0, crop: 0 }),
          merchantsAvailable: 0,
          merchantsTotal: 0,
          hasResources: true
        };

        allVillages = [central, villageNear, villageFar];
        trainingVillages = [villageNear, villageFar];
        trainingCentralKey = "central";

        const plan = {
          feasible: true,
          targetSec: 120,
          equalizedByCurrent: false,
          totalTransfer: withResourceTotal({ wood: 4000, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central,
          centralAvailable: withResourceTotal(central.current),
          activeQueues: 2,
          villagePlans: [
            {
              village: villageNear,
              status: "NPC",
              currentTime: 0,
              totalTargetSec: 120,
              counts: [{ label:"C", troopName:"Guardia Ash", units:100 }],
              deficit: withResourceTotal({ wood: 2000, clay: 0, iron: 0, crop: 0 })
            },
            {
              village: villageFar,
              status: "NPC",
              currentTime: 0,
              totalTargetSec: 120,
              counts: [{ label:"C", troopName:"Guardia Ash", units:100 }],
              deficit: withResourceTotal({ wood: 2000, clay: 0, iron: 0, crop: 0 })
            }
          ]
        };

        const finalize = (payload) => {
          window.fetch = originalFetch;
          window.open = originalOpen;
          getServerTimeFromLocal = originalGetServerTimeFromLocal;
          Date = OriginalDate;
          done(payload);
        };

        generateTrainingTradeLinks(plan).then((rows) => {
          renderTrainingResult(plan);
          openAllTrainingLinks();
          finalize({
            rows: rows.map(item => ({
              village: item.villageName,
              did: item.didDest,
              repeat: item.repeat,
              send: item.sendLabel,
              distance: item.distanceLabel,
              r1: item.perTrip.wood,
              url: item.url
            })),
            opened: window.__opened
          });
        }).catch((error) => {
          finalize({ error: error.message || String(error) });
        });
        """,
        MAP_SQL_EXAMPLE
    )

    assert "error" not in result, result.get("error")
    assert [item["village"] for item in result["rows"]] == ["Villa Esperanza", "Ojitos Rojos"], "Los links no se ordenaron por distancia desde la central"
    assert result["rows"][0]["did"] == 32286 and result["rows"][1]["did"] == 32289, "No se resolvio did_dest desde map.sql"
    assert result["rows"][0]["repeat"] == 1, "La aldea cercana no debia dividirse en varios envios"
    assert result["rows"][1]["repeat"] == 2, "La aldea que no calzaba debia dividirse entre 2"
    assert result["rows"][0]["send"] == "06:59", "La primera salida no se programo con el minuto extra inicial en hora servidor UTC+1"
    assert "did_dest=32286" in result["rows"][0]["url"] and "trade_route_mode=send" in result["rows"][0]["url"], "El link generado no siguio el formato esperado"
    assert len(result["opened"]) == 2 and all("build.php?gid=17" in item for item in result["opened"]), "Abrir todo no abrio las rutas comerciales esperadas"


def test_npc_training_uses_project_root_map_sql(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        const mapSql = arguments[0];
        const originalFetch = window.fetch;

        window.fetch = async (url) => {
          const textUrl = String(url || "");
          if (textUrl.startsWith(window.location.origin) && textUrl.includes("/map.sql")) {
            return { ok: true, text: async () => mapSql };
          }
          throw new Error("Remote blocked");
        };

        const central = {
          id: "central",
          name: "Villa Tormento",
          key: "central",
          sourceOrder: 0,
          race: "EGIPTO",
          raceSupported: true,
          isTraining: false,
          isCentral: true,
          x: 84,
          y: -165,
          warehouseCap: 400000,
          granaryCap: 880000,
          merchantsAvailable: 20,
          merchantsTotal: 20,
          current: withResourceTotal({ wood: 200000, clay: 200000, iron: 200000, crop: 200000 }),
          hasResources: true
        };
        const village = {
          id: "villa-a",
          name: "Villa Esperanza",
          key: "villa-a",
          sourceOrder: 1,
          race: "HUNOS",
          raceSupported: true,
          isTraining: true,
          isCentral: false,
          x: 84,
          y: -166,
          did: 0,
          warehouseCap: 10000,
          granaryCap: 10000,
          merchantsAvailable: 10,
          merchantsTotal: 10,
          current: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          hasResources: true
        };

        allVillages = [central, village];
        trainingVillages = [village];
        trainingCentralKey = "central";
        trainingLastGeneratedLinks = [];
        document.getElementById("trainingServerHost").value = "eternos.x3.hispano.travian.com";
        syncGlobalTrainingConfigFromDom();

        const plan = {
          feasible: true,
          targetSec: 120,
          equalizedByCurrent: false,
          totalTransfer: withResourceTotal({ wood: 1000, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central,
          centralAvailable: withResourceTotal(central.current),
          activeQueues: 1,
          villagePlans: [{
            village,
            status: "NPC",
            currentTime: 0,
            totalTargetSec: 120,
            counts: [{ label:"C", troopName:"Guardia Ash", units:50 }],
            deficit: withResourceTotal({ wood: 1000, clay: 0, iron: 0, crop: 0 })
          }]
        };

        generateTrainingTradeLinks(plan).then((rows) => {
          const status = document.getElementById("trainingMapSqlStatus").textContent || "";
          window.fetch = originalFetch;
          done({
            rows: rows.map(item => ({ village: item.villageName, did: item.didDest, url: item.url })),
            status
          });
        }).catch((error) => {
          window.fetch = originalFetch;
          done({ error: error.message || String(error) });
        });
        """,
        MAP_SQL_X_WORLD_EXAMPLE
    )

    assert "error" not in result, result.get("error")
    assert result["rows"][0]["did"] == 32286, "NPC entrenamiento no tomo el did desde el map.sql del proyecto en formato x_world"
    assert "proyecto" in result["status"].lower(), "NPC entrenamiento no indico que estaba usando el map.sql local del proyecto"


def test_npc_training_parallel_merchant_departures_share_same_time(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_async_script(
        """
        const mapSql = arguments[0];
        const done = arguments[arguments.length - 1];
        const originalFetch = window.fetch;
        const originalGetServerTimeFromLocal = getServerTimeFromLocal;
        const OriginalDate = Date;

        window.fetch = async (url) => ({
          ok: String(url).includes("/map.sql"),
          text: async () => mapSql
        });

        Date = class extends OriginalDate {
          constructor(...args){
            if(args.length){
              super(...args);
            } else {
              super("2026-04-12T05:58:00Z");
            }
          }
          static now(){
            return new OriginalDate("2026-04-12T05:58:00Z").getTime();
          }
        };
        getServerTimeFromLocal = (date) => new OriginalDate(date.getTime() + 6 * 3600000);

        document.getElementById("serverSpeed").value = "1";
        document.getElementById("globalMarketBonus").value = "0";
        document.getElementById("trainingTradeOfficeEnabled").checked = false;
        document.getElementById("trainingMarketplaceLevel").value = "20";
        document.getElementById("trainingServerHost").value = "eternos.x3.hispano.travian.com";
        syncGlobalTrainingConfigFromDom();

        const central = {
          id: "central",
          name: "Villa Tormento",
          key: "central",
          sourceOrder: 0,
          race: "EGIPTO",
          raceSupported: true,
          isTraining: false,
          isCentral: true,
          x: 84,
          y: -165,
          warehouseCap: 400000,
          granaryCap: 880000,
          current: withResourceTotal({ wood: 100000, clay: 100000, iron: 100000, crop: 100000 }),
          merchantsAvailable: 20,
          merchantsTotal: 20,
          hasResources: true
        };
        const villageA = {
          id: "a",
          name: "Villa Esperanza",
          key: "a",
          sourceOrder: 1,
          race: "HUNOS",
          raceSupported: true,
          isTraining: true,
          isCentral: false,
          x: 84,
          y: -166,
          did: 0,
          warehouseCap: 999999,
          granaryCap: 999999,
          current: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          merchantsAvailable: 0,
          merchantsTotal: 0,
          hasResources: true
        };
        const villageB = {
          id: "b",
          name: "Villa Emoción",
          key: "b",
          sourceOrder: 2,
          race: "EGIPTO",
          raceSupported: true,
          isTraining: true,
          isCentral: false,
          x: 84,
          y: -164,
          did: 0,
          warehouseCap: 999999,
          granaryCap: 999999,
          current: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          merchantsAvailable: 0,
          merchantsTotal: 0,
          hasResources: true
        };

        allVillages = [central, villageA, villageB];
        trainingVillages = [villageA, villageB];
        trainingCentralKey = "central";

        const plan = {
          feasible: true,
          targetSec: 120,
          equalizedByCurrent: false,
          totalTransfer: withResourceTotal({ wood: 9750, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central,
          centralAvailable: withResourceTotal(central.current),
          activeQueues: 2,
          villagePlans: [
            {
              village: villageA,
              status: "NPC",
              currentTime: 0,
              totalTargetSec: 120,
              counts: [{ label:"C", troopName:"Arquero", units:100 }],
              deficit: withResourceTotal({ wood: 6750, clay: 0, iron: 0, crop: 0 })
            },
            {
              village: villageB,
              status: "NPC",
              currentTime: 0,
              totalTargetSec: 120,
              counts: [{ label:"C", troopName:"Guardia Ash", units:100 }],
              deficit: withResourceTotal({ wood: 3000, clay: 0, iron: 0, crop: 0 })
            }
          ]
        };

        generateTrainingTradeLinks(plan).then((rows) => {
          window.fetch = originalFetch;
          getServerTimeFromLocal = originalGetServerTimeFromLocal;
          Date = OriginalDate;
          done({
            rows: rows.map(item => ({
              village: item.villageName,
              send: item.sendLabel,
              merchantsNeeded: item.merchantsNeeded
            }))
          });
        }).catch((error) => {
          window.fetch = originalFetch;
          getServerTimeFromLocal = originalGetServerTimeFromLocal;
          Date = OriginalDate;
          done({ error: error.message || String(error) });
        });
        """,
        MAP_SQL_EXAMPLE
    )

    assert "error" not in result, result.get("error")
    assert result["rows"][0]["merchantsNeeded"] == 9 and result["rows"][1]["merchantsNeeded"] == 4, "La prueba no preparo correctamente las dos rutas con 9 y 4 mercaderes"
    assert result["rows"][0]["send"] == "06:59" and result["rows"][1]["send"] == "06:59", "Si el pool alcanza para ambas rutas, deben salir a la misma hora usando el minuto extra inicial"


def test_npc_training_link_lead_minutes_parameter_changes_first_departure(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_async_script(
        """
        const mapSql = arguments[0];
        const done = arguments[arguments.length - 1];
        const originalFetch = window.fetch;
        const originalGetServerTimeFromLocal = getServerTimeFromLocal;
        const OriginalDate = Date;

        window.fetch = async (url) => ({
          ok: String(url).includes("/map.sql"),
          text: async () => mapSql
        });

        Date = class extends OriginalDate {
          constructor(...args){
            if(args.length){
              super(...args);
            } else {
              super("2026-04-12T05:58:00Z");
            }
          }
          static now(){
            return new OriginalDate("2026-04-12T05:58:00Z").getTime();
          }
        };
        getServerTimeFromLocal = (date) => new OriginalDate(date.getTime() + 6 * 3600000);

        document.getElementById("serverSpeed").value = "1";
        document.getElementById("globalMarketBonus").value = "0";
        document.getElementById("trainingTradeOfficeEnabled").checked = false;
        document.getElementById("trainingMarketplaceLevel").value = "20";
        document.getElementById("trainingServerHost").value = "eternos.x3.hispano.travian.com";
        document.getElementById("trainingLinkLeadMinutes").value = "3";
        syncGlobalTrainingConfigFromDom();

        const central = {
          id: "central",
          name: "Villa Tormento",
          key: "central",
          sourceOrder: 0,
          race: "EGIPTO",
          raceSupported: true,
          isTraining: false,
          isCentral: true,
          x: 84,
          y: -165,
          warehouseCap: 400000,
          granaryCap: 880000,
          current: withResourceTotal({ wood: 100000, clay: 100000, iron: 100000, crop: 100000 }),
          merchantsAvailable: 20,
          merchantsTotal: 20,
          hasResources: true
        };
        const village = {
          id: "a",
          name: "Villa Esperanza",
          key: "a",
          sourceOrder: 1,
          race: "HUNOS",
          raceSupported: true,
          isTraining: true,
          isCentral: false,
          x: 84,
          y: -166,
          warehouseCap: 999999,
          granaryCap: 999999,
          current: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          merchantsAvailable: 0,
          merchantsTotal: 0,
          hasResources: true
        };

        allVillages = [central, village];
        trainingVillages = [village];
        trainingCentralKey = "central";

        const plan = {
          feasible: true,
          targetSec: 120,
          equalizedByCurrent: false,
          totalTransfer: withResourceTotal({ wood: 1000, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central,
          centralAvailable: withResourceTotal(central.current),
          activeQueues: 1,
          villagePlans: [{
            village,
            status: "NPC",
            currentTime: 0,
            totalTargetSec: 120,
            counts: [{ label:"C", troopName:"Guardia Ash", units:50 }],
            deficit: withResourceTotal({ wood: 1000, clay: 0, iron: 0, crop: 0 })
          }]
        };

        generateTrainingTradeLinks(plan).then((rows) => {
          window.fetch = originalFetch;
          getServerTimeFromLocal = originalGetServerTimeFromLocal;
          Date = OriginalDate;
          done({ send: rows[0]?.sendLabel || "" });
        }).catch((error) => {
          window.fetch = originalFetch;
          getServerTimeFromLocal = originalGetServerTimeFromLocal;
          Date = OriginalDate;
          done({ error: error.message || String(error) });
        });
        """,
        MAP_SQL_EXAMPLE
    )

    assert "error" not in result, result.get("error")
    assert result["send"] == "07:01", "El parametro de minutos extra no movio la primera salida al minuto configurado"


def test_npc_training_next_departure_rounds_up_to_minute_after_second_precision_return(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_script(
        """
        const windowInfo = reserveMerchantWindow(
          [new Date("2026-04-12T09:24:20Z").getTime()],
          1,
          new Date("2026-04-12T09:20:00Z"),
          75
        );
        return {
          send: formatDateAsServerHm(windowInfo.sendDate).label,
          returnAt: formatDateAsServerHms(windowInfo.releaseDate).label
        };
        """
    )

    assert result["send"] == "10:25", "La siguiente salida no se redondeo al minuto superior cuando el mercader regresaba con segundos"
    assert result["returnAt"] == "10:26:15", "El regreso no mantuvo la precision por segundos tras redondear la salida"


def test_npc_training_next_departure_adds_one_extra_minute_when_return_is_exact_minute(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_script(
        """
        const windowInfo = reserveMerchantWindow(
          [new Date("2026-04-12T09:24:00Z").getTime()],
          1,
          new Date("2026-04-12T09:20:00Z"),
          90
        );
        return {
          send: formatDateAsServerHm(windowInfo.sendDate).label,
          returnAt: formatDateAsServerHms(windowInfo.releaseDate).label
        };
        """
    )

    assert result["send"] == "10:25", "Si el mercader regresaba exacto al minuto, la siguiente salida debia sumar un minuto extra de margen"
    assert result["returnAt"] == "10:26:30", "El regreso final no mantuvo correctamente el nuevo minuto de margen"


def test_npc_training_calculate_links_does_not_open_preview(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        const originalGenerateTrainingTradeLinks = generateTrainingTradeLinks;
        const originalOpen = window.open;
        const originalShowStatus = showStatus;
        window.__opened = [];
        window.open = (url) => {
          window.__opened.push(url || "preview");
          return {
            document: { write(){}, close(){} }
          };
        };

        const central = {
          id: "central",
          name: "Villa Tormento",
          key: "central",
          sourceOrder: 0,
          race: "EGIPTO",
          raceSupported: true,
          isTraining: false,
          isCentral: true,
          x: 84,
          y: -165,
          warehouseCap: 400000,
          granaryCap: 880000,
          merchantsAvailable: 20,
          merchantsTotal: 20,
          current: withResourceTotal({ wood: 100000, clay: 100000, iron: 100000, crop: 100000 }),
          hasResources: true
        };
        const village = {
          id: "villa-a",
          name: "Villa Esperanza",
          key: "villa-a",
          sourceOrder: 1,
          race: "HUNOS",
          raceSupported: true,
          isTraining: true,
          isCentral: false,
          x: 84,
          y: -166,
          did: 32286,
          warehouseCap: 10000,
          granaryCap: 10000,
          current: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          merchantsAvailable: 0,
          merchantsTotal: 0,
          hasResources: true
        };

        allVillages = [central, village];
        trainingVillages = [village];
        trainingCentralKey = "central";
        trainingLastGeneratedLinks = [];
        trainingLinksUiState = { status: "idle", message: "" };

        const plan = {
          feasible: true,
          targetSec: 120,
          equalizedByCurrent: false,
          totalTransfer: withResourceTotal({ wood: 1000, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central,
          centralAvailable: withResourceTotal(central.current),
          activeQueues: 1,
          villagePlans: [{
            village,
            status: "NPC",
            currentTime: 0,
            totalTargetSec: 120,
            counts: [{ label:"C", troopName:"Guardia Ash", units:50 }],
            deficit: withResourceTotal({ wood: 1000, clay: 0, iron: 0, crop: 0 })
          }]
        };

        generateTrainingTradeLinks = async () => {
          trainingLastGeneratedLinks = [{
          villageKey: village.key,
          villageName: village.name,
          distance: 1,
          distanceLabel: "1.00",
          didDest: 32286,
          travelSeconds: 120,
          repeat: 1,
          sendLabel: "07:00",
          nextReadyLabel: "07:04:00",
          perTrip: withResourceTotal({ wood: 1000, clay: 0, iron: 0, crop: 0 }),
          perTripTotal: 1000,
          merchantsNeeded: 1,
          capacityEach: 18000,
          fitDetail: "Entra completo",
          fitOk: true,
          overMerchantCapacity: false,
          url: "https://eternos.x3.hispano.travian.com/build.php?gid=17&t=3&did_dest=32286&r1=1000&r2=0&r3=0&r4=0&trade_route_mode=send&hour=7&minute=0&repeat=1&every=24&action=traderoute"
          }];
          return trainingLastGeneratedLinks;
        };

        showStatus = () => {};
        renderTrainingResult(plan);
        document.getElementById("btnCalculateTrainingLinks").click();

        setTimeout(() => {
          const rowCount = document.querySelectorAll(".training-links-table tbody tr").length;
          const opened = window.__opened.slice();
          generateTrainingTradeLinks = originalGenerateTrainingTradeLinks;
          window.open = originalOpen;
          showStatus = originalShowStatus;
          done({ rowCount, opened });
        }, 50);
        """
    )

    assert result["rowCount"] == 1, "Calcular links no lleno la matriz inferior de rutas comerciales"
    assert result["opened"] == [], "Calcular links no debe abrir ninguna pestaña; solo debe llenar la matriz inferior"


def test_npc_training_links_table_shows_speed_return_and_total_merchant_capacity(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_script(
        """
        trainingLastGeneratedLinks = [{
          villageKey: "villa-a",
          villageName: "Villa Esperanza",
          distance: 1,
          distanceLabel: "1.00",
          didDest: 32286,
          sendLabel: "07:36",
          merchantSpeed: 16,
          travelSeconds: 75,
          nextReadyLabel: "07:38:45",
          repeat: 2,
          perTripTotal: 149388,
          merchantsNeeded: 9,
          capacityEach: 18000,
          merchantTotalCapacity: 162000,
          fitDetail: "Entra completo",
          overMerchantCapacity: false,
          url: "https://example.com"
        }];
        return {
          html: renderTrainingLinksTable(trainingLastGeneratedLinks)
        };
        """
    )

    assert "Vel." in result["html"], "La tabla de links no agrego la columna de velocidad de mercaderes"
    assert "Regreso" in result["html"], "La tabla de links no agrego la columna de hora de regreso"
    assert "16 c/h" in result["html"], "La tabla de links no mostro la velocidad de mercaderes en casillas por hora"
    assert "07:38:45" in result["html"], "La tabla de links no mostro la hora final de regreso con precision a segundos"
    assert "9 x 18000 = 162000" in result["html"], "La tabla de links no mostro la capacidad total de mercaderes usados"


def test_npc_training_send_button_changes_color_after_click(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    driver.execute_script(
        """
        trainingLastGeneratedLinks = [{
          villageKey: "villa-a",
          villageName: "Villa Esperanza",
          distance: 1,
          distanceLabel: "1.00",
          didDest: 32286,
          sendLabel: "07:36",
          merchantSpeed: 16,
          travelSeconds: 75,
          nextReadyLabel: "07:38:45",
          repeat: 2,
          perTripTotal: 149388,
          merchantsNeeded: 9,
          capacityEach: 18000,
          merchantTotalCapacity: 162000,
          fitDetail: "Entra completo",
          overMerchantCapacity: false,
          url: "https://example.com"
        }];
        trainingSentLinkState = {};
        renderTrainingResult({
          feasible: true,
          targetSec: 120,
          totalTransfer: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central: { name: "Central" },
          centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
          activeQueues: 1,
          villagePlans: []
        });
        document.querySelector('.training-link-btn').addEventListener('click', (event) => event.preventDefault(), { once: true });
        """
    )

    driver.find_element(By.CSS_SELECTOR, ".training-link-btn").click()

    result = driver.execute_script(
        """
        const button = document.querySelector('.training-link-btn');
        return {
          text: button.textContent.trim(),
          sent: button.classList.contains('is-sent')
        };
        """
    )

    assert result["sent"], "El boton Enviar no cambio de color/estado tras hacer click"
    assert result["text"] == "Enviado", "El boton Enviar no actualizo su texto tras hacer click"


def test_npc_training_shows_link_progress_feedback(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    result = driver.execute_script(
        """
        trainingLastGeneratedLinks = [];
        trainingLinksUiState = {
          status: "loading",
          message: "Consultando map.sql y calculando rutas comerciales."
        };
        renderTrainingResult({
          feasible: true,
          targetSec: 120,
          equalizedByCurrent: false,
          totalTransfer: withResourceTotal({ wood: 4000, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central: { name: "Central" },
          centralAvailable: withResourceTotal({ wood: 500000, clay: 500000, iron: 500000, crop: 500000 }),
          activeQueues: 1,
          villagePlans: [{
            village: { key: "villa-a", name: "Villa A", warehouseCap: 999999, granaryCap: 999999, current: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 }) },
            status: "NPC",
            currentTime: 0,
            totalTargetSec: 120,
            counts: [{ label:"C", troopName:"Imperiano", units:10 }],
            deficit: withResourceTotal({ wood: 1000, clay: 0, iron: 0, crop: 0 })
          }]
        });
        return {
          text: document.querySelector('.training-links-feedback')?.textContent || "",
          hasProgress: document.querySelector('.training-links-progress span') !== null
        };
        """
    )

    assert "Generando links" in result["text"], "La seccion de links no mostro un mensaje de progreso mientras calcula"
    assert result["hasProgress"], "La seccion de links no mostro una barra de progreso al calcular"


def test_npc_training_sanitizes_link_error_feedback(driver, base_url):
    driver.get(f"{base_url}/npcentrenamiento/")
    wait_for(driver, "#btnImportTraining")

    driver.execute_script(
        """
        const central = {
          id: "central",
          name: "Villa Tormento",
          key: "central",
          sourceOrder: 0,
          race: "EGIPTO",
          raceSupported: true,
          isTraining: false,
          isCentral: true,
          x: 84,
          y: -165,
          warehouseCap: 400000,
          granaryCap: 880000,
          merchantsAvailable: 20,
          merchantsTotal: 20,
          current: withResourceTotal({ wood: 100000, clay: 100000, iron: 100000, crop: 100000 }),
          hasResources: true
        };

        allVillages = [central];
        trainingCentralKey = "central";
        trainingLastGeneratedLinks = [];
        trainingLinksUiState = { status: "idle", message: "" };
        window.__originalGenerateTrainingTradeLinks = generateTrainingTradeLinks;
        generateTrainingTradeLinks = async () => {
          throw new Error("Failed to fetch");
        };

        renderTrainingResult({
          feasible: true,
          targetSec: 120,
          equalizedByCurrent: false,
          totalTransfer: withResourceTotal({ wood: 1000, clay: 0, iron: 0, crop: 0 }),
          villageTransfers: [],
          central,
          centralAvailable: withResourceTotal(central.current),
          activeQueues: 1,
          villagePlans: [{
            village: {
              key: "villa-a",
              name: "Villa A",
              warehouseCap: 999999,
              granaryCap: 999999,
              current: withResourceTotal({ wood: 0, clay: 0, iron: 0, crop: 0 })
            },
            status: "NPC",
            currentTime: 0,
            totalTargetSec: 120,
            counts: [{ label:"C", troopName:"Imperiano", units:10 }],
            deficit: withResourceTotal({ wood: 1000, clay: 0, iron: 0, crop: 0 })
          }]
        });
        """
    )

    driver.find_element(By.ID, "btnCalculateTrainingLinks").click()
    WebDriverWait(driver, 10).until(
        lambda d: d.find_element(By.CSS_SELECTOR, ".training-links-feedback.is-error").is_displayed()
    )

    feedback = driver.find_element(By.CSS_SELECTOR, ".training-links-feedback.is-error").text
    status = driver.find_element(By.ID, "statusLine").text

    assert "Failed to fetch" not in feedback and "Failed to fetch" not in status, "El error de links se mostro crudo en vez de sanitizado"
    assert "map.sql" in feedback, "El mensaje sanitizado de error no explico que fallo la descarga de map.sql"


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


def test_attack_planner_defaults(driver, base_url):
    driver.get(f"{base_url}/planificadorataques/")
    wait_for(driver, "#btnAddAttackRow")

    speed = Select(driver.find_element(By.ID, "serverSpeed")).first_selected_option.get_attribute("value")
    reminder_seconds = driver.find_element(By.ID, "attackReminderSeconds").get_attribute("value")
    arrival_at = driver.find_element(By.ID, "attackArrivalAt").get_attribute("value")
    subtitle = driver.find_element(By.ID, "attackEditorSubtitle").text
    empty_text = driver.find_element(By.ID, "attackRowsBody").text
    troop_tag = driver.find_element(By.CSS_SELECTOR, ".attack-editor-name").tag_name.lower()
    attack_controls_in_new_attack = driver.execute_script(
        """
        const form = document.querySelector('.attack-form-grid');
        const toolbar = document.querySelector('.toolbar');
        const count = document.getElementById('attackCountMultiplier');
        const kind = document.getElementById('attackKind');
        return Boolean(form && count && kind && form.contains(count) && form.contains(kind) && !toolbar.contains(count) && !toolbar.contains(kind));
        """
    )

    assert speed == "3", "Planificador de Ataques no inicio con velocidad x3"
    assert reminder_seconds == "60", "Planificador de Ataques no inicio con recordatorio de 60 segundos"
    assert arrival_at == "", "La hora objetivo de llegada debe iniciar nula por defecto"
    assert troop_tag == "select", "El editor de tropas debe usar una lista desplegable"
    assert attack_controls_in_new_attack, "Cantidad ataques y Tipo ataque deben estar dentro de Nuevo ataque"
    assert "Borrador actual" in subtitle, "El panel lateral no abrio el borrador por defecto"
    assert "Todavia no hay ataques" in empty_text, "La matriz inicial no mostro el estado vacio esperado"


def test_attack_planner_adds_row_and_generates_attack_link(driver, base_url):
    driver.get(f"{base_url}/planificadorataques/")
    wait_for(driver, "#btnAddAttackRow")

    map_sql = (
        "INSERT INTO `x_world` VALUES "
        "(1,0,0,1,1001,'Origen Uno',1,'Jugador',0,'',0,NULL,FALSE,NULL,NULL,NULL),"
        "(2,40,0,1,1002,'Destino Dos',1,'Jugador',0,'',0,NULL,FALSE,NULL,NULL,NULL);"
    )

    result = driver.execute_async_script(
        """
        const mapSql = arguments[0];
        const done = arguments[arguments.length - 1];

        document.getElementById("attackMapSqlInput").value = mapSql;
        document.getElementById("attackMapSqlInput").dispatchEvent(new Event("input", { bubbles: true }));
        document.getElementById("attackRace").value = "HUNOS";
        document.getElementById("attackRace").dispatchEvent(new Event("change", { bubbles: true }));
        document.getElementById("attackOriginX").value = "0";
        document.getElementById("attackOriginY").value = "0";
        document.getElementById("attackTargetX").value = "40";
        document.getElementById("attackTargetY").value = "0";
        document.getElementById("attackTournamentLevel").value = "10";

        attackDraft.troops = [
          { uid: "t1", name: "Mercenario", quantity: 100 },
          { uid: "t2", name: "Ariete", quantity: 2 }
        ];
        openAttackEditor("draft", null);
        applySuggestedArrivalToDraft();
        addDraftAttack();

        setTimeout(() => {
          const row = document.querySelector('#attackRowsBody tr[data-attack-id="1"]');
          done({
            rowCount: document.querySelectorAll('#attackRowsBody tr[data-attack-id]').length,
            rowText: row ? row.textContent : "",
            travel: row ? row.querySelector('td:nth-child(7)')?.textContent.trim() : "",
            detail: row ? row.querySelector('td:nth-child(10)')?.textContent.trim() : "",
            link: row ? row.querySelector('a')?.href || "" : "",
            status: document.getElementById("statusLine").textContent.trim()
          });
        }, 50);
        """,
        map_sql
    )

    assert result["rowCount"] == 1, "El planificador no agrego la fila del ataque"
    assert "Origen Uno" in result["rowText"] and "Destino Dos" in result["rowText"], "La fila no resolvio nombres con map.sql manual"
    assert result["travel"] == "03:20:00", "El viaje no aplico correctamente la plaza de torneos mas alla de 20 casillas"
    assert result["detail"] == "x1", "La fila no mostro el detalle de cantidad de ataques configurado"
    assert "eventType=3" in result["link"], "El link de ataque no fijo eventType=3"
    assert "troop%5Bt1%5D=100" in result["link"] and "troop%5Bt7%5D=2" in result["link"], "El link de ataque no incluyo las tropas correctas"
    assert "agregada al planificador" in result["status"], "La interfaz no confirmo el alta de la fila"


def test_attack_planner_processes_reminders(driver, base_url):
    driver.get(f"{base_url}/planificadorataques/")
    wait_for(driver, "#btnAddAttackRow")

    result = driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        const fmtLocalWithSeconds = (date) => {
          const pad = (value) => String(value).padStart(2, "0");
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        };
        window.clearInterval(attackReminderLoopId);
        window.__beeped = false;
        window.__notif = null;
        playAttackReminderSound = () => { window.__beeped = true; };
        window.Notification = function(title, options){
          window.__notif = { title, options };
        };
        window.Notification.permission = "granted";

        document.getElementById("attackReminderSeconds").value = "69";
        attackRows = [{
          id: 1,
          race: "HUNOS",
          originX: "0",
          originY: "0",
          targetX: "0",
          targetY: "0",
          tournamentLevel: 0,
          arrivalAt: fmtLocalWithSeconds(addSeconds(new Date(), 30)),
          troops: [{ uid: "r1", name: "Mercenario", quantity: 1 }],
          lastAlertKey: ""
        }];
        attackLastVillageLookup = {};
        renderAttackRows({});
        processAttackReminders();

        setTimeout(() => {
          const row = document.querySelector('#attackRowsBody tr');
          const rowStyle = getComputedStyle(row.querySelector("td"));
          const badge = document.querySelector('#attackRowsBody tr td:nth-child(8)')?.textContent.trim() || "";
          done({
            beeped: window.__beeped,
            notification: window.__notif ? window.__notif.title : "",
            alertKey: attackRows[0].lastAlertKey || "",
            badge,
            rowBackground: rowStyle.backgroundColor,
            rowColor: rowStyle.color
          });
        }, 20);
        """
    )

    assert result["beeped"], "El recordatorio no reprodujo sonido cuando la fila entro en ventana de envio"
    assert result["notification"] == "Ataque por enviar", "El recordatorio no disparo la notificacion esperada"
    assert result["alertKey"], "El recordatorio no marco la fila como ya avisada"
    assert result["badge"] == "69", "La matriz no mostro los segundos de aviso configurados tras procesar el recordatorio"
    assert "127, 29, 29" in result["rowBackground"] and "255, 255, 255" in result["rowColor"], "Cuando el aviso llega a cero la fila REAL debe recuperar fondo rojo oscuro y texto blanco"


def test_attack_planner_editor_updates_row_troops(driver, base_url):
    driver.get(f"{base_url}/planificadorataques/")
    wait_for(driver, "#btnAddAttackRow")

    result = driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        attackRows = [{
          id: 1,
          race: "HUNOS",
          originX: "0",
          originY: "0",
          targetX: "10",
          targetY: "0",
          tournamentLevel: 0,
          arrivalAt: formatDateTimeLocal(addSeconds(new Date(), 3600)),
          troops: [{ uid: "r1", name: "Mercenario", quantity: 1 }],
          lastAlertKey: ""
        }];
        renderAttackRows({});
        openAttackEditor("row", 1);

        const nameInput = document.querySelector(".attack-editor-name");
        const qtyInput = document.querySelector(".attack-editor-qty");
        nameInput.value = "Ariete";
        nameInput.dispatchEvent(new Event("input", { bubbles: true }));
        qtyInput.value = "3";
        qtyInput.dispatchEvent(new Event("input", { bubbles: true }));
        saveAttackEditorTroops();

        setTimeout(() => {
          const row = attackRows[0];
          const view = computeAttackRowView(row, {});
          done({
            troopName: row && row.troops[0] ? row.troops[0].name : "",
            troopQty: row && row.troops[0] ? row.troops[0].quantity : 0,
            link: view.attackLink || "",
            status: document.getElementById("statusLine").textContent.trim()
          });
        }, 20);
        """
    )

    assert result["troopName"] == "Ariete" and result["troopQty"] == 3, "Guardar desde el panel lateral no actualizo las tropas de la fila"
    assert "troop%5Bt7%5D=3" in result["link"], "Guardar desde el panel lateral no actualizo el link con la nueva tropa"
    assert "Tropas guardadas en la fila 1" in result["status"], "La interfaz no confirmo el guardado desde el panel lateral"


def test_attack_planner_suggested_arrival_updates_all_rows_with_extra_minutes(driver, base_url):
    driver.get(f"{base_url}/planificadorataques/")
    wait_for(driver, "#btnAddAttackRow")

    result = driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        window.clearInterval(attackReminderLoopId);
        document.getElementById("attackExtraMinutes").value = "7";
        document.getElementById("attackCountMultiplier").value = "8";

        attackRows = [
          {
            id: 1,
            race: "HUNOS",
            originX: "0",
            originY: "0",
            targetX: "10",
            targetY: "0",
            tournamentLevel: 0,
            attackCountMultiplier: 8,
            arrivalAt: "",
            troops: [{ uid: "r1", name: "Mercenario", quantity: 1 }],
            lastAlertKey: ""
          },
          {
            id: 2,
            race: "HUNOS",
            originX: "0",
            originY: "0",
            targetX: "60",
            targetY: "0",
            tournamentLevel: 0,
            attackCountMultiplier: 8,
            arrivalAt: "",
            troops: [{ uid: "r2", name: "Catapulta", quantity: 1 }],
            lastAlertKey: "old-alert"
          }
        ];
        attackDraft = {
          race: "HUNOS",
          originX: "0",
          originY: "0",
          targetX: "20",
          targetY: "0",
          tournamentLevel: 0,
          arrivalAt: "",
          arrivalAuto: true,
          troops: [{ uid: "d1", name: "Mercenario", quantity: 1 }]
        };
        syncDraftToDom();

        const before = new Date();
        applySuggestedArrivalToDraft();
        setTimeout(() => {
          const arrival = parseDateTimeLocal(attackRows[0].arrivalAt);
          const longestTravel = Math.max(...attackRows.map((row) => computeAttackRowView(row, {}).travelSeconds));
          const diffSeconds = Math.round((arrival.getTime() - before.getTime()) / 1000);
          const row = document.querySelector('#attackRowsBody tr[data-attack-id="1"]');
          done({
            sameArrival: attackRows.every((row) => row.arrivalAt === attackRows[0].arrivalAt) && attackDraft.arrivalAt === attackRows[0].arrivalAt,
            secondsAreZero: arrival.getSeconds() === 0,
            includesExtra: diffSeconds >= longestTravel + (7 * 60),
            alertReset: attackRows.every((row) => row.lastAlertKey === ""),
            detail: row ? row.querySelector('td:nth-child(10)')?.textContent.trim() : ""
          });
        }, 50);
        """
    )

    assert result["sameArrival"], "Usar llegada sugerida no aplico la misma llegada al borrador y todas las filas"
    assert result["secondsAreZero"], "La llegada sugerida no redondeo hacia arriba al minuto exacto"
    assert result["includesExtra"], "La llegada sugerida no sumo los minutos extras configurados"
    assert result["alertReset"], "Cambiar la llegada sugerida debe reiniciar avisos ya marcados"
    assert result["detail"] == "x8", "La columna de detalle de ataques no reflejo el multiplicador configurado"


def test_attack_planner_exports_and_imports_shared_config(driver, base_url):
    driver.get(f"{base_url}/planificadorataques/")
    wait_for(driver, "#btnAddAttackRow")

    result = driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        window.clearInterval(attackReminderLoopId);
        document.getElementById("serverSpeed").value = "3";
        document.getElementById("attackServerHost").value = "server.example.test";
        document.getElementById("attackReminderSeconds").value = "69";
        document.getElementById("attackExtraMinutes").value = "11";
        document.getElementById("attackCountMultiplier").value = "4";

        const arrival = new Date(2026, 3, 25, 23, 26, 0);
        const localArrival = formatDateTimeLocal(arrival);
        attackRows = [{
          id: 3,
          race: "HUNOS",
          originX: "84",
          originY: "-166",
          targetX: "25",
          targetY: "-25",
          tournamentLevel: 15,
          attackCountMultiplier: 4,
          arrivalAt: localArrival,
          troops: [
            { uid: "r1", name: "Catapulta", quantity: 1 },
            { uid: "r2", name: "Mercenario", quantity: 1 }
          ],
          lastAlertKey: "already-alerted"
        }];
        attackDraft = {
          race: "HUNOS",
          originX: "84",
          originY: "-166",
          targetX: "25",
          targetY: "-25",
          tournamentLevel: 15,
          arrivalAt: localArrival,
          arrivalAuto: false,
          troops: [{ uid: "d1", name: "Catapulta", quantity: 1 }]
        };
        syncDraftToDom();

        const exported = buildAttackConfigExport();
        attackRows = [];
        attackDraft = createDefaultDraft("HUNOS");
        syncDraftToDom();
        applyAttackConfig(exported);

        setTimeout(() => {
          const row = attackRows[0];
          const view = computeAttackRowView(row, {});
          done({
            schema: exported.schema,
            iso: exported.attacks[0].arrivalAtIso,
            expectedIso: arrival.toISOString(),
            rowCount: attackRows.length,
            reminder: document.getElementById("attackReminderSeconds").value,
            extra: document.getElementById("attackExtraMinutes").value,
            multiplier: row.attackCountMultiplier,
            localArrival: row.arrivalAt,
            expectedLocalArrival: formatDateTimeLocal(new Date(exported.attacks[0].arrivalAtIso)),
            alertReset: row.lastAlertKey === "",
            troopText: document.querySelector('#attackRowsBody tr[data-attack-id="3"] td:nth-child(9)')?.textContent.trim() || "",
            serverArrival: document.querySelector('#attackRowsBody tr[data-attack-id="3"] td:nth-child(13)')?.textContent.trim() || "",
            link: view.attackLink || ""
          });
        }, 50);
        """
    )

    assert result["schema"] == "travian-attack-planner-config", "La exportacion no uso el schema esperado"
    assert result["iso"] == result["expectedIso"], "La exportacion no guardo la llegada como instante ISO compartible"
    assert result["rowCount"] == 1, "La importacion no reconstruyo la lista de ataques"
    assert result["reminder"] == "69" and result["extra"] == "11", "La importacion no restauro los parametros del planificador"
    assert result["multiplier"] == 4, "La importacion no restauro el detalle de cantidad de ataques"
    assert result["localArrival"] == result["expectedLocalArrival"], "La importacion no recalculo la llegada local desde ISO con el navegador"
    assert result["alertReset"], "La importacion debe limpiar avisos previos del archivo compartido"
    assert "Catapulta: 1" in result["troopText"] and "Mercenario: 1" in result["troopText"], "La importacion no restauro las tropas"
    assert "05:26:00" in result["serverArrival"], "La matriz no mostro la hora server de llegada importada con +6 horas"
    assert "server.example.test" in result["link"], "La importacion no restauro el servidor para generar links"


def test_attack_planner_real_arrival_report_uses_editable_matrix_value(driver, base_url):
    driver.get(f"{base_url}/planificadorataques/")
    wait_for(driver, "#btnAddAttackRow")

    result = driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        window.clearInterval(attackReminderLoopId);
        attackLastVillageLookup = {
          "25,-25": { x: 25, y: -25, did: 1002, name: "Objetivo Real" }
        };
        attackRows = [{
          id: 1,
          race: "HUNOS",
          originX: "84",
          originY: "-166",
          targetX: "25",
          targetY: "-25",
          tournamentLevel: 15,
          attackCountMultiplier: 4,
          arrivalAt: "2026-04-25T23:26",
          realArrivalAt: "2026-04-25T23:31",
          troops: [{ uid: "r1", name: "Catapulta", quantity: 1 }],
          lastAlertKey: ""
        }];
        renderAttackRows(attackLastVillageLookup);

        const input = document.querySelector(".attack-real-arrival-input");
        input.value = "2026-04-25T23:45";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        const report = buildAttackReport(attackLastVillageLookup);
        const exported = buildAttackConfigExport();

        done({
          rowRealArrival: attackRows[0].realArrivalAt,
          report,
          realIso: exported.attacks[0].realArrivalAtIso,
          status: document.getElementById("statusLine").textContent.trim()
        });
        """
    )

    assert result["rowRealArrival"] == "2026-04-25T23:45", "Editar la hora real en matriz no actualizo la fila"
    assert "Objetivo Real (25|-25)" in result["report"], "El reporte no incluyo aldea destino con coordenadas"
    assert "25/04/2026 23:45:00" in result["report"], "El reporte no uso la hora de llegada real editable"
    assert result["realIso"], "La exportacion no guardo la hora de llegada real"
    assert "Hora de llegada real actualizada" in result["status"], "La interfaz no confirmo la edicion de hora real"


def test_attack_planner_slowest_selector_and_real_fake_rows(driver, base_url):
    driver.get(f"{base_url}/planificadorataques/")
    wait_for(driver, "#btnAddAttackRow")

    result = driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        window.clearInterval(attackReminderLoopId);
        const futureArrival = formatDateTimeLocal(addSeconds(new Date(), 86400));

        const editor = document.querySelector(".attack-editor-card");
        const mapSql = document.getElementById("attackMapSqlInput");
        const table = document.querySelector(".attack-table-wrap");
        const editorBeforeTable = Boolean(editor && table && (editor.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING));
        const editorBeforeMapSql = Boolean(editor && mapSql && (editor.compareDocumentPosition(mapSql) & Node.DOCUMENT_POSITION_FOLLOWING));

        attackRows = [
          {
            id: 1,
            race: "HUNOS",
            originX: "0",
            originY: "0",
            targetX: "40",
            targetY: "0",
            tournamentLevel: 0,
            attackCountMultiplier: 1,
            attackKind: "REAL",
            arrivalAt: futureArrival,
            realArrivalAt: futureArrival,
            troops: [
              { uid: "r1", name: "Catapulta", quantity: 1 },
              { uid: "r2", name: "Mercenario", quantity: 50 }
            ],
            lastAlertKey: ""
          },
          {
            id: 2,
            race: "HUNOS",
            originX: "0",
            originY: "0",
            targetX: "40",
            targetY: "0",
            tournamentLevel: 0,
            attackCountMultiplier: 1,
            attackKind: "FAKE",
            arrivalAt: futureArrival,
            realArrivalAt: futureArrival,
            troops: [
              { uid: "f1", name: "Mercenario", quantity: 1 }
            ],
            lastAlertKey: ""
          }
        ];
        renderAttackRows({});

        const realRow = document.querySelector('#attackRowsBody tr[data-attack-id="1"]');
        const fakeRow = document.querySelector('#attackRowsBody tr[data-attack-id="2"]');
        const realStyle = getComputedStyle(realRow.querySelector("td"));
        const fakeStyle = getComputedStyle(fakeRow.querySelector("td"));
        const realColor = realStyle.color;
        const realBackground = realStyle.backgroundColor;
        const fakeColor = fakeStyle.color;
        const fakeBackground = fakeStyle.backgroundColor;
        const beforeTravel = realRow.querySelector('td:nth-child(7)')?.textContent.trim() || "";
        const slowestSelect = realRow.querySelector(".attack-slowest-select");
        const options = Array.from(slowestSelect.options).map((option) => option.value);
        slowestSelect.value = "Mercenario";
        slowestSelect.dispatchEvent(new Event("change", { bubbles: true }));

        setTimeout(() => {
          const updatedRow = document.querySelector('#attackRowsBody tr[data-attack-id="1"]');
          done({
            editorBeforeTable,
            editorBeforeMapSql,
            realClass: realRow.classList.contains("is-real-attack"),
            fakeClass: fakeRow.classList.contains("is-fake-attack"),
            realColor,
            realBackground,
            fakeColor,
            fakeBackground,
            beforeTravel,
            afterTravel: updatedRow.querySelector('td:nth-child(7)')?.textContent.trim() || "",
            selectedSlowest: attackRows[0].slowestTroopName,
            options,
            exportedKind: buildAttackConfigExport().attacks[1].attackKind
          });
        }, 80);
        """
    )

    assert result["editorBeforeTable"], "El editor de tropas no quedo arriba de la matriz"
    assert result["editorBeforeMapSql"], "El editor de tropas debe quedar justo despues de Nuevo ataque, antes de map.sql"
    assert result["realClass"] and result["fakeClass"], "Las filas REAL/FAKE no recibieron sus clases de color"
    assert "127, 29, 29" in result["realColor"] and "255, 255, 255" in result["realBackground"], f"REAL debe usar fondo blanco y texto rojo oscuro antes del aviso: {result['realColor']} / {result['realBackground']}"
    assert "30, 58, 138" in result["fakeColor"] and "255, 255, 255" in result["fakeBackground"], f"FAKE debe usar fondo blanco y texto azul oscuro antes del aviso: {result['fakeColor']} / {result['fakeBackground']}"
    assert "Catapulta" in result["options"] and "Mercenario" in result["options"], "Tropa lenta no se limita a las tropas escogidas"
    assert result["beforeTravel"] == "06:40:00", "La tropa lenta calculada por defecto no uso la catapulta"
    assert result["afterTravel"] == "03:20:00", "Editar tropa lenta no recalculo la duracion del viaje"
    assert result["selectedSlowest"] == "Mercenario", "La matriz no guardo la tropa lenta editada"
    assert result["exportedKind"] == "FAKE", "La exportacion no preservo el tipo REAL/FAKE"


def test_attack_planner_orders_rows_by_distance_and_offsets_server_time(driver, base_url):
    driver.get(f"{base_url}/planificadorataques/")
    wait_for(driver, "#btnAddAttackRow")

    result = driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        window.clearInterval(attackReminderLoopId);
        const baseRow = {
          race: "HUNOS",
          originX: "0",
          originY: "0",
          targetY: "0",
          tournamentLevel: 0,
          attackCountMultiplier: 1,
          attackKind: "REAL",
          arrivalAt: "2026-04-25T23:26",
          realArrivalAt: "2026-04-25T23:26",
          troops: [{ uid: "r", name: "Mercenario", quantity: 1 }],
          lastAlertKey: ""
        };
        attackRows = [
          { ...baseRow, id: 1, targetX: "40" },
          { ...baseRow, id: 2, targetX: "10" },
          { ...baseRow, id: 3, targetX: "25" }
        ];
        renderAttackRows({});
        const firstOrder = Array.from(document.querySelectorAll("#attackRowsBody tr[data-attack-id]")).map((row) => row.getAttribute("data-attack-id"));

        attackRows.push({ ...baseRow, id: 4, targetX: "5" });
        renderAttackRows({});
        const secondOrder = Array.from(document.querySelectorAll("#attackRowsBody tr[data-attack-id]")).map((row) => row.getAttribute("data-attack-id"));
        const row4 = document.querySelector('#attackRowsBody tr[data-attack-id="4"]');

        done({
          firstOrder,
          secondOrder,
          localSend: row4.querySelector("td:nth-child(11)")?.textContent.trim() || "",
          serverSend: row4.querySelector("td:nth-child(12)")?.textContent.trim() || "",
          serverArrival: row4.querySelector("td:nth-child(13)")?.textContent.trim() || ""
        });
        """
    )

    assert result["firstOrder"] == ["2", "3", "1"], "La matriz no ordeno las filas por distancia de menor a mayor"
    assert result["secondOrder"] == ["4", "2", "3", "1"], "La matriz no reordeno dinamicamente al agregar mas ataques"
    assert "23:01:00" in result["localSend"], "La hora local de envio no se mostro como esperaba"
    assert "05:01:00" in result["serverSend"], "La hora server de envio no sumo 6 horas a la hora local"
    assert "05:26:00" in result["serverArrival"], "La hora server no sumo 6 horas a la hora local"


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
                ("npc_party_mode_import_add_row_and_summary", test_npc_party_mode_import_add_row_and_summary),
                ("npc_party_mode_result_delete_removes_row", test_npc_party_mode_result_delete_removes_row),
                ("npc_party_mode_generates_links_from_manual_map_sql", test_npc_party_mode_generates_links_from_manual_map_sql),
                ("npc_party_mode_detects_siglas_for_central_and_destinations", test_npc_party_mode_detects_siglas_for_central_and_destinations),
                ("npc_training_capacity_parser", test_npc_training_capacity_parser),
                ("npc_training_usage_guide", test_npc_training_usage_guide),
                ("npc_training_capacity_import_without_resources", test_npc_training_capacity_import_without_resources),
                ("npc_training_resources_parser", test_npc_training_resources_parser),
                ("npc_training_capacity_and_resources_import", test_npc_training_capacity_and_resources_import),
                ("npc_training_import_preserves_resource_order", test_npc_training_import_preserves_resource_order),
                ("npc_training_default_building_levels_start_at_20", test_npc_training_default_building_levels_start_at_20),
                ("npc_training_central_total_and_village_transfers", test_npc_training_central_total_and_village_transfers),
                ("npc_training_uses_village_transfers_only_after_central_exhausts", test_npc_training_uses_village_transfers_only_after_central_exhausts),
                ("npc_training_central_capacity_cap", test_npc_training_central_capacity_cap),
                ("npc_training_finds_lower_target_when_equalized_base_does_not_fit", test_npc_training_finds_lower_target_when_equalized_base_does_not_fit),
                ("npc_training_npc_central_boxes", test_npc_training_npc_central_boxes),
                ("npc_training_central_overview_cards", test_npc_training_central_overview_cards),
                ("npc_training_detects_prefixed_central_and_market_controls", test_npc_training_detects_prefixed_central_and_market_controls),
                ("npc_training_equalize_times_toggle_and_parser", test_npc_training_equalize_times_toggle_and_parser),
                ("npc_training_ignores_great_buildings_and_hospital", test_npc_training_ignores_great_buildings_and_hospital),
                ("npc_training_without_header_uses_last_four_columns", test_npc_training_without_header_uses_last_four_columns),
                ("npc_training_without_header_uses_last_four_values", test_npc_training_without_header_uses_last_four_values),
                ("npc_training_equalizes_current_plus_new_time", test_npc_training_equalizes_current_plus_new_time),
                ("npc_training_equalize_times_requires_training_block", test_npc_training_equalize_times_requires_training_block),
                ("npc_training_equalize_times_matches_training_names_without_colon", test_npc_training_equalize_times_matches_training_names_without_colon),
                ("npc_training_equalize_times_ignores_unconfigured_buildings", test_npc_training_equalize_times_ignores_unconfigured_buildings),
                ("npc_training_split_buttons", test_npc_training_split_buttons),
                ("npc_training_copy_distribution_uses_configured_village_order", test_npc_training_copy_distribution_uses_configured_village_order),
                ("npc_training_copy_distribution_table_uses_columns_and_village_order", test_npc_training_copy_distribution_table_uses_columns_and_village_order),
                ("npc_training_global_modifiers", test_npc_training_global_modifiers),
                ("npc_training_queue_names", test_npc_training_queue_names),
                ("npc_training_resource_icons", test_npc_training_resource_icons),
                ("npc_training_total_and_capacity_fit_columns", test_npc_training_total_and_capacity_fit_columns),
                ("npc_training_destination_capacity_mode_uses_only_central_and_keeps_optimizing", test_npc_training_destination_capacity_mode_uses_only_central_and_keeps_optimizing),
                ("npc_training_capacity_fit_column_is_forced_to_yes_in_destination_cap_mode", test_npc_training_capacity_fit_column_is_forced_to_yes_in_destination_cap_mode),
                ("npc_training_generates_trade_links_from_map_sql", test_npc_training_generates_trade_links_from_map_sql),
                ("npc_training_uses_project_root_map_sql", test_npc_training_uses_project_root_map_sql),
                ("npc_training_parallel_merchant_departures_share_same_time", test_npc_training_parallel_merchant_departures_share_same_time),
                ("npc_training_link_lead_minutes_parameter_changes_first_departure", test_npc_training_link_lead_minutes_parameter_changes_first_departure),
                ("npc_training_next_departure_rounds_up_to_minute_after_second_precision_return", test_npc_training_next_departure_rounds_up_to_minute_after_second_precision_return),
                ("npc_training_next_departure_adds_one_extra_minute_when_return_is_exact_minute", test_npc_training_next_departure_adds_one_extra_minute_when_return_is_exact_minute),
                ("npc_training_calculate_links_does_not_open_preview", test_npc_training_calculate_links_does_not_open_preview),
                ("npc_training_links_table_shows_speed_return_and_total_merchant_capacity", test_npc_training_links_table_shows_speed_return_and_total_merchant_capacity),
                ("npc_training_send_button_changes_color_after_click", test_npc_training_send_button_changes_color_after_click),
                ("npc_training_shows_link_progress_feedback", test_npc_training_shows_link_progress_feedback),
                ("npc_training_sanitizes_link_error_feedback", test_npc_training_sanitizes_link_error_feedback),
                ("npc_training_delivered_and_delete_controls", test_npc_training_delivered_and_delete_controls),
                ("npc_training_mobile_horizontal_scroll", test_npc_training_mobile_horizontal_scroll),
                ("attack_planner_defaults", test_attack_planner_defaults),
                ("attack_planner_adds_row_and_generates_attack_link", test_attack_planner_adds_row_and_generates_attack_link),
                ("attack_planner_processes_reminders", test_attack_planner_processes_reminders),
                ("attack_planner_editor_updates_row_troops", test_attack_planner_editor_updates_row_troops),
                ("attack_planner_suggested_arrival_updates_all_rows_with_extra_minutes", test_attack_planner_suggested_arrival_updates_all_rows_with_extra_minutes),
                ("attack_planner_exports_and_imports_shared_config", test_attack_planner_exports_and_imports_shared_config),
                ("attack_planner_real_arrival_report_uses_editable_matrix_value", test_attack_planner_real_arrival_report_uses_editable_matrix_value),
                ("attack_planner_slowest_selector_and_real_fake_rows", test_attack_planner_slowest_selector_and_real_fake_rows),
                ("attack_planner_orders_rows_by_distance_and_offsets_server_time", test_attack_planner_orders_rows_by_distance_and_offsets_server_time),
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
