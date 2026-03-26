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
    options.add_argument("--headless")
    options.add_argument("--window-size=1440,1200")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--remote-debugging-port=0")

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
    paths = ["/roi/", "/npc/", "/oasis/", "/listadevacas/", "/cultura/"]
    for path in paths:
        driver.get(f"{base_url}{path}")
        assert_theme_toggle(driver)


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
                ("roi", test_roi),
                ("npc", test_npc),
                ("oasis", test_oasis),
                ("vacas", test_vacas),
                ("cultura", test_cultura),
            ]
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
