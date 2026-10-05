# Nastavitev Google Drive Webhooka (1 minuta)

Aplikacija "GPS Sequence" lahko pošilja točke neposredno v vaš osebni Google Drive preko preprostega Google Apps Scripta. Ta način je 100% zanesljiv v ozadju, saj ne zahteva OAuth potrjevanja ali prijavnih žetonov, ki bi potekli.

### Navodila po korakih:

1. V brskalniku odprite **[Google Apps Script](https://script.google.com/)** z vašim Google računom.
2. Kliknite na gumb **»New project«** (Nov projekt).
3. Pobrišite obstoječo vsebino v urejevalniku (`function myFunction() { ... }`).
4. Kopirajte celotno vsebino iz datoteke `Code.js` (nahaja se v tej mapi) in jo prilepite v urejevalnik.
5. Zgoraj kliknite modri gumb **»Deploy«** (Uvedi) -> izberite **»New deployment«** (Nova uvedba).
6. Pri zobniku (Select type) izberite **»Web app«**.
7. Izpolnite polja:
   - **Description**: `GPS Sequence Webhook`
   - **Execute as**: `Me (vaš@gmail.com)`
   - **Who has access**: **`Anyone`** *(Pomembno: to omogoča, da telefon zapiše podatke v vaš Drive brez zapletenih prijavnih oken)*
8. Kliknite **»Deploy«**. Google vas bo vprašal za dovoljenje za dostop do Google Drive (`Authorize access` -> izberite svoj račun -> `Advanced` -> `Go to Untitled project (unsafe)` -> `Allow`).
9. Po zaključku boste dobili **Web app URL**, ki se začne z:
   `https://script.google.com/macros/s/AKfy.../exec`
10. Ta URL preprosto prekopirajte ali vpišite v polje **Drive Webhook URL** v aplikaciji na telefonu.

Ko aplikacija pošlje podatke, se na vašem Google Drive avtomatsko ustvari mapa **`gps_tracks`**, v njej pa datoteka z današnjim datumom (npr. `gps_track_2026-10-04.jsonl`), kamor se vsakih $t_2$ sekund dopisujejo GPS točke!
