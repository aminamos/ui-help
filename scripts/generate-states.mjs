// Generates data/states.json and STATES.md from the verified 50-state research.
// Sources: workflow research 2026-11-10 (official state pages; see unresolved
// notes in STATES.md). Hours are encoded ONLY where an official source states
// them, except Iowa (see README note). Run: node scripts/generate-states.mjs
import { writeFileSync, mkdirSync } from "node:fs";

// [code, name, agency, loginUrl, infoUrl, timezone, hoursText, hours, loginVia, verification, notes]
// hours: "all" | null | [daysCsv, openHour, closeHour]
const ROWS = [
  ["AL","Alabama","Alabama Department of Workforce","https://uiclaimantportal.labor.alabama.gov/SignIn","https://adol.alabama.gov/unemployment-compensation/","America/Chicago","Hours not published",null,"Login.gov","official page fetched","Hours unverified on new Claimant Portal."],
  ["AK","Alaska","Alaska Department of Labor and Workforce Development","https://my.alaska.gov/PrerequisiteProcess?pubid=bif","https://labor.alaska.gov/unemployment/","America/Juneau","24 hours, 7 days","all",null,"official page fetched",""],
  ["AZ","Arizona","Arizona Department of Economic Security","https://uibenefits.az.gov/","https://des.az.gov/services/employment/unemployment-individual/apply-ui-benefits","America/Phoenix","24 hours, 7 days","all","ID.me","official page fetched",""],
  ["AR","Arkansas","Arkansas Division of Workforce Services","https://www.ezarc.adws.arkansas.gov/","https://reemployment.arkansas.gov/unemployment-for-individuals/how-to/apply-for-unemployment-insurance/","America/Chicago","Mon-Fri 6am-6pm & Sun 7am-6pm",null,"Login.gov","official page fetched","Hours not encodable as one daily window (Sunday starts 7am), so hours left unset."],
  ["CA","California","California Employment Development Department","https://myedd.edd.ca.gov/s/","https://edd.ca.gov/en/unemployment","America/Los_Angeles","24 hours, 7 days","all","ID.me","official page fetched",""],
  ["CO","Colorado","Colorado Department of Labor and Employment","https://myui.clouduim.cdle.state.co.us/Claimant/Core/Login.aspx","https://cdle.colorado.gov/unemployment","America/Denver","Hours not published",null,"ID.me","official search result - page returned 403 to fetcher","Hours unverified; login URL from official CDLE MyUI+ search result."],
  ["CT","Connecticut","Connecticut Department of Labor","https://reemployct.dol.ct.gov/accessct/faces/login/login_local.xhtml","https://portal.ct.gov/dolui/reemployctclaimants","America/New_York","24/7/365 except maintenance","all",null,"official page fetched",""],
  ["DE","Delaware","Delaware Department of Labor","https://uicc.delawareworks.com/Consumer/Default.aspx","https://labor.delaware.gov/divisions/unemployment-insurance/","America/New_York","Hours not published",null,"ID.me","official page fetched","Hours unverified on current official page."],
  ["FL","Florida","Florida Department of Commerce","https://connect.myflorida.com/Claimant/Core/Login.ASPX","https://floridajobs.org/workforce-resources/reemployment-assistance","America/New_York","Hours not published",null,"ID.me","official search result - page returned 403 to fetcher","Hours unverified; claimant login URL from official FloridaJobs Reconnect Logins page."],
  ["GA","Georgia","Georgia Department of Labor","https://www.dol.state.ga.us/public/uiben/customer/login","https://dol.georgia.gov/unemployment-benefits","America/New_York","Hours not published",null,"ID.me","official page fetched","Hours unverified on fetched login page."],
  ["HI","Hawaii","Hawaii Dept. of Labor and Industrial Relations UI Division","https://huiclaims.hawaii.gov/","https://labor.hawaii.gov/ui/","Pacific/Honolulu","Mon-Fri 6:30am-11pm; weekends/holidays 9am-11pm HST",["1,2,3,4,5",6,23],"Login.gov","official page fetched","Encoded window truncates the 6:30am start and weekend 9am start; HoursText is exact."],
  ["ID","Idaho","Idaho Department of Labor","https://www2.labor.idaho.gov/ClaimantPortal/Login","https://www.labor.idaho.gov/unemployment-benefits/","America/Boise","24 hours, 7 days, incl. holidays","all","ID.me","official page fetched",""],
  ["IL","Illinois","Illinois Dept. of Employment Security","https://benefits.ides.illinois.gov","https://ides.illinois.gov/unemployment/insurance.html","America/Chicago","Mon-Fri 3am-7:30pm online certification",["1,2,3,4,5",3,19],"ILogin","official page fetched","Encoded window truncates the 7:30pm end to 19:00; HoursText is exact. Login uses state ILogin."],
  ["IN","Indiana","Indiana Dept. of Workforce Development","https://uplink.in.gov/CSS/CSSLogon.htm","https://www.in.gov/dwd/indiana-unemployment/","America/Indiana/Indianapolis","24 hours, 7 days","all","ID.me","official page fetched",""],
  ["IA","Iowa","Iowa Workforce Development","https://www.iowaworks.gov/vosnet/Default.aspx","https://workforce.iowa.gov/unemployment","America/Chicago","Initial claim 24h/day; weekly 24h except Sat","all","ID.me","official page fetched","Kept as researched: encoded 24/7 for initial claims; weekly requests are 24h except Saturday per HoursText."],
  ["KS","Kansas","Kansas Department of Labor","https://kansasui.gov/","https://www.dol.ks.gov/unemployment/overview","America/Chicago","24 hours a day, 7 days a week","all",null,"official search result - page returned 403 to fetcher","Verified from official KDOL Claimant Handbook and overview snippet, not a full fetched page."],
  ["KY","Kentucky","Kentucky Office of Unemployment Insurance","https://uiclaimsportal.ky.gov/","https://kcc.ky.gov/career/individuals/Pages/If-You-Are-Unemployed-3.aspx","America/Kentucky/Louisville","Online filing 24 hours, 7 days","all","ID.me","official page fetched","Older pages list limited website hours; the newer page says 24/7."],
  ["LA","Louisiana","Louisiana Workforce Commission","https://www.louisianaworks.net/hire","https://www.laworks.net/FAQs/FAQ_UI_ClaimantBenefits.asp","America/Chicago","File anytime; 24 hours, 7 days","all",null,"official page fetched",""],
  ["ME","Maine","Maine Department of Labor","https://assist.reemployme.maine.gov/cp/landing","https://www.maine.gov/unemployment/","America/New_York","Online 24/7","all",null,"official search result - page returned 403 to fetcher","Verified from official MDOL news articles via search, not a fetched maine.gov page."],
  ["MD","Maryland","Maryland Dept. of Labor Division of Unemployment Insurance","https://beacon.labor.maryland.gov/ReBEACONClaimant/Account/Login","https://labor.maryland.gov/unemployment-insurance/claimants/","America/New_York","BEACON online 24/7","all",null,"official page fetched",""],
  ["MA","Massachusetts","Dept. of Unemployment Assistance","https://unemployment.mass.gov/Claimants/","https://www.mass.gov/unemployment","America/New_York","Hours not published",null,null,"official page fetched","No online portal hours published (6am-10pm is TeleCert phone only)."],
  ["MI","Michigan","Unemployment Insurance Agency","https://miui.michigan.gov/claimant","https://www.michigan.gov/leo/bureaus-agencies/uia","America/Detroit","24 hours, 7 days","all",null,"official page fetched",""],
  ["MN","Minnesota","Unemployment Insurance Program (DEED)","https://www1.ui.mn.gov/ui_applicant/ui/applicant/login","https://www.uimn.org/applicants/howapply/application-process/self-service.jsp","America/Chicago","Sun-Fri 6am-8pm",["0,1,2,3,4,5",6,20],null,"official page fetched","Hours read directly from the login page: Sunday-Friday 6:00 A.M. to 8:00 P.M. Central."],
  ["MS","Mississippi","Dept. of Employment Security","https://reemployms.mdes.ms.gov/cp/landing","https://www.mdes.ms.gov/unemployment-claims","America/Chicago","24 hours, 7 days","all",null,"official page fetched",""],
  ["MO","Missouri","Division of Employment Security","https://uinteract.labor.mo.gov/benefits/","https://labor.mo.gov/des/how-to-file","America/Chicago","24/7","all",null,"official page fetched",""],
  ["MT","Montana","Unemployment Insurance Division","https://uiclaimant.mt.gov","https://uid.dli.mt.gov/claimants/faq","America/Denver","Hours not published",null,"Okta and Login.gov","official page fetched","No portal hours published."],
  ["NE","Nebraska","Dept. of Labor","https://neworks.nebraska.gov/vosnet/default.aspx","https://dol.nebraska.gov/UIBenefits","America/Chicago","Hours not published",null,null,"official page fetched","No portal hours published."],
  ["NV","Nevada","Dept. of Employment, Training and Rehabilitation","https://nui.nv.gov/","https://detr.nv.gov/Page/Unemployment_Insurance_Benefits","America/Los_Angeles","Hours not published",null,"ID.me","official page fetched","No portal hours published."],
  ["NH","New Hampshire","Employment Security","https://nhuis.nh.gov/claimant/login","https://www.nhes.nh.gov/services/claimants/file.htm","America/New_York","Hours not published",null,null,"official search result - page returned 403 to fetcher","Login URL verified via official File for Benefits search result."],
  ["NJ","New Jersey","Division of Unemployment Insurance","https://unemployment.nj.gov/","https://myunemployment.nj.gov/","America/New_York","Sun-Fri 8am-6pm to certify",["0,1,2,3,4,5",8,18],"ID.me","official page fetched",""],
  ["NM","New Mexico","New Mexico Department of Workforce Solutions","https://www.jobs.dws.nm.gov/vosnet/Default.aspx","https://www.dws.state.nm.us/en-us/Unemployment/Unemployment-for-an-Individual","America/Denver","24 hours, 7 days","all",null,"official search result - direct page fetch rejected; login page fetched",""],
  ["NY","New York","New York State Department of Labor","https://www.labor.ny.gov/signin","https://dol.ny.gov/unemployment-insurance","America/New_York","Filing Mon-Thu 7:30am-7:30pm, Fri to 5pm, Sat-Sun to 7pm",null,"ID.me","official page fetched","Filing hours differ by service and sign-in is described as 24/7, so hours left unset."],
  ["NC","North Carolina","NC Division of Employment Security","https://claims.ui.des.nc.gov/CSS/","https://www.des.nc.gov/individuals/apply-ui","America/New_York","Hours not published",null,null,"official page fetched","Online hours not published."],
  ["ND","North Dakota","Job Service North Dakota","https://apps.nd.gov/jsnd/uiiaclaims/login.htm","https://www.jobsnd.com/unemployment-individuals","America/Chicago","Hours not published",null,null,"official page fetched","Online hours not published; only maintenance notices found."],
  ["OH","Ohio","Ohio Dept of Job and Family Services","https://unemployment.ohio.gov/","https://jfs.ohio.gov/job-services-and-unemployment/unemployment/for-unemployed-workers/overview","America/New_York","Hours not published",null,"OHID","official page fetched","Login is via OHID. Online hours not published."],
  ["OK","Oklahoma","Oklahoma Employment Security Commission","https://claimantportal.oesc.ok.gov/","https://oklahoma.gov/oesc/individuals/unemployment.html","America/Chicago","Hours not published",null,null,"official page fetched","Online hours not published."],
  ["OR","Oregon","Oregon Employment Department","https://frances.oregon.gov/Claimant/_/","https://unemployment.oregon.gov/","America/Los_Angeles","24 hours, 7 days","all",null,"official page fetched",""],
  ["PA","Pennsylvania","PA Dept of Labor and Industry","https://benefits.uc.pa.gov/","https://www.pa.gov/agencies/dli/resources/for-claimants-workers/benefits-information/uc-guides-tutorials/how-to-file","America/New_York","24 hours, 7 days for initial claim","all","ID.me","official page fetched",""],
  ["RI","Rhode Island","RI Dept of Labor and Training","https://beta.uionline.dlt.ri.gov/","https://dlt.ri.gov/individuals/unemployment-insurance/apply-unemployment-benefits","America/New_York","Hours not published",null,null,"official page fetched","Online hours not published."],
  ["SC","South Carolina","SC Dept of Employment and Workforce","https://scuihub.dew.sc.gov/CSS/CSSLogon.htm","https://dew.sc.gov/individuals/applying-benefits","America/New_York","24 hours, 7 days to check status","all","ID.me","official page fetched",""],
  ["SD","South Dakota","Department of Labor and Regulation","https://www.sd.gov/rabenefits","https://dlr.sd.gov/ra/individuals/default.aspx","America/Chicago","24 hours, 7 days","all",null,"official page fetched","Login URL proven by link on fetched official page."],
  ["TN","Tennessee","Department of Labor and Workforce Development","https://jobs4tnui.tn.gov/claimant/","https://www.tn.gov/workforce/unemployment/apply-for-benefits.html","America/Chicago","24/7 online","all",null,"official page fetched","Login URL proven by link on fetched official page."],
  ["TX","Texas","Texas Workforce Commission","https://apps.twc.texas.gov/UBS/security/logon.do","https://www.twc.texas.gov/services/apply-benefits","America/Chicago","24 hours, 7 days","all","ID.me","official page fetched","Login URL proven by link on fetched official page."],
  ["UT","Utah","Department of Workforce Services","https://jobs.utah.gov/ui/home","https://jobs.utah.gov/ui/home","America/Denver","7 days 2:00am-11:45pm",null,null,"official page fetched","Hours not encodable as integer hours, so hours left unset."],
  ["VT","Vermont","Department of Labor","https://labor.ui.vermont.gov/UI/Claimant/","https://labor.vermont.gov/unemployment-insurance/ui-claimants/establishing-unemployment-claim","America/New_York","24/7 access","all",null,"official page fetched",""],
  ["VA","Virginia","Virginia Employment Commission","https://uidirect.vec.virginia.gov/CSS/CSSLogon.htm","https://www.vec.virginia.gov/apply-unemployment-benefits","America/New_York","24 hours, 7 days (except maintenance)","all","ID.me","official page fetched",""],
  ["WA","Washington","Employment Security Department","https://secure.esd.wa.gov/home/","https://esd.wa.gov/get-financial-help/unemployment-benefits/applying-unemployment-benefits/about-eservices-individuals","America/Los_Angeles","Hours not published",null,"SecureAccess Washington (SAW)","official page fetched","Hours unverified on the fetched eServices page."],
  ["WV","West Virginia","WorkForce West Virginia","https://uc.workforcewv.org/consumer/?lang=en","https://workforcewv.org/unemployment-insurance-benefits/my-unemployment-claim/","America/New_York","Hours not published",null,null,"official page fetched","No portal hours published."],
  ["WI","Wisconsin","Department of Workforce Development","https://my.unemployment.wisconsin.gov/","https://dwd.wisconsin.gov/ui/claimant","America/Chicago","Sun 9am-midnight; Mon-Fri 24h; Sat midnight-3pm",null,"Login.gov","official page fetched","Hours vary by day, so hours left unset."],
  ["WY","Wyoming","Department of Workforce Services","https://wyui.wyo.gov/","https://dws.wyo.gov/dws-division/unemployment-insurance/claimants/","America/Denver","Hours not published",null,"ID.me and Login.gov","official page fetched","Only a weekday 7:00-7:30am maintenance window is stated."],
];

const EXTRA = [
  ["DC","District of Columbia","Dept. of Employment Services","https://does.dcnetworks.org/ClaimantServices/logon.aspx","https://does.dc.gov/page/unemployment-compensation","America/New_York","Hours not published",null,"ID.me","district","URL-only - login URL found on fetched official info page; login page itself not checked","Hours not researched for this row."],
  ["PR","Puerto Rico","Dept. of Labor and Human Resources (DTRH)","https://desempleo.trabajo.pr.gov/vosnet/default.aspx","https://www.trabajo.pr.gov/seguro_por_desempleo.asp","America/Puerto_Rico","Hours not published",null,null,"territory","URL-only - login URL found on fetched official info page; login page itself not checked","Hours not researched for this row."],
  ["VI","U.S. Virgin Islands","Virgin Islands Department of Labor","https://myuiclaim.vi.gov/","https://unemployment.vidol.gov/","America/St_Thomas","Hours not published",null,null,"territory","URL-only - login URL found on fetched official info page; login page itself not checked","Hours not researched for this row."],
];

const states = ROWS.map((r) => ({
  code: r[0], name: r[1], agency: r[2], loginUrl: r[3], infoUrl: r[4], timezone: r[5], hoursText: r[6],
  hours: r[7] === "all" ? "all" : Array.isArray(r[7]) ? { days: r[7][0].split(",").map(Number), openHour: r[7][1], closeHour: r[7][2] } : null,
  loginVia: r[8], status: "live", type: "state", verification: r[9], notes: r[10],
}));
const extra = EXTRA.map((r) => ({
  code: r[0], name: r[1], agency: r[2], loginUrl: r[3], infoUrl: r[4], timezone: r[5], hoursText: r[6],
  hours: null, loginVia: r[8], status: "live", type: r[9], verification: r[10], notes: r[11],
}));

const codes = states.map((s) => s.code);
if (states.length !== 50 || new Set(codes).size !== 50) throw new Error(`Expected 50 unique states, got ${states.length}/${new Set(codes).size}`);
for (const s of [...states, ...extra]) {
  if (!s.loginUrl || !s.infoUrl || !s.timezone) throw new Error(`Incomplete row ${s.code}`);
}

const payload = {
  generatedFrom: "Verified official-source research, 2026-11-10. See STATES.md for per-state verification and notes. Hours are null where no official daily window could be encoded; never guess hours.",
  counts: { states: states.length, districtsAndTerritories: extra.length, total: states.length + extra.length },
  states: [...states, ...extra],
};
mkdirSync("data", { recursive: true });
writeFileSync("data/states.json", JSON.stringify(payload, null, 2) + "\n");

const esc = (v) => String(v ?? "").replace(/\|/g, "\\|");
const hoursCell = (s) => s.hours === "all" ? "24/7" : s.hours ? `${s.hours.days.join(",")} ${s.hours.openHour}:00-${s.hours.closeHour}:00` : "—";
const lines = [];
lines.push("# UI Help — state coverage", "");
lines.push("Every state below was checked against an official state source on 2026-11-10. **Hours are only encoded where an official source states a daily window** — where hours are `—`, the official source did not publish hours or the hours vary in a way a single window cannot express, and this project does not guess.", "");
lines.push("`data/states.json` holds 50 state rows plus 3 district/territory rows (DC, PR, VI), each marked with its `type`. Pre-login only: no state login is attempted and no filing is submitted anywhere.", "");
lines.push("| Code | State | Agency | Login | Info | Timezone | Hours (official text) | Encoded | Login via | Verification | Notes |");
lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
for (const s of [...states, ...extra]) {
  lines.push(`| ${s.code}${s.type !== "state" ? " (" + s.type + ")" : ""} | ${esc(s.name)} | ${esc(s.agency)} | ${s.loginUrl} | ${s.infoUrl} | ${s.timezone} | ${esc(s.hoursText)} | ${hoursCell(s)} | ${esc(s.loginVia || "—")} | ${esc(s.verification)} | ${esc(s.notes || "—")} |`);
}
lines.push("", "## Known limits", "");
lines.push("- Many states route identity proofing through ID.me or Login.gov (see Login via). A future login step must hand off to that provider; it cannot be bypassed.");
lines.push("- Restricted windows encoded so far: HI, IL, MN, NJ. AR, NY, UT, WI publish restricted hours that a single daily window cannot encode, so they stay unencoded until the scheduler supports per-day windows.");
lines.push("- Iowa is encoded 24/7 for initial claims; its weekly requests run 24h except Saturday (see its HoursText).");
writeFileSync("STATES.md", lines.join("\n") + "\n");
console.log(`Wrote data/states.json (${states.length} states + ${extra.length} district/territories) and STATES.md`);
