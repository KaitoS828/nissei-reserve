import JSZip from "jszip";
import type { DayRow } from "./lodging-tax";

// 北海道が公開している「宿泊税納入申告書・月計表・納入書」のExcelひな形に、集計結果を流し込む。
// 納入書シートには図形などの部品が入っていて、Excelライブラリで開き直して保存すると壊れる。
// そのため、ファイルの中身（XML）の該当セルだけを直接書き換え、他は一切触らない。

export type OfficialInput = {
  submittedOn: Date | null; // 申告書提出年月日
  operatorAddress: string;
  operatorName: string;
  corporateNo: string;
  facilityAddress: string;
  facilityName: string;
  designationNo: string;
  fiscalYear: number; // 払込年度（令和）
  periodStart: Date; // 申告対象月の初日
  periodEnd: Date; // 申告対象月の末日
  dueDate: Date; // 納期限
  months: DayRow[][]; // 月計表①②③（日ごとの宿泊数）
};

const serial = (d: Date) => Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(1899, 11, 30)) / 86400000);

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Value = number | string;

// <c r="D6" s="193"/> のような空セルを、値入りのセルに置き換える
function setCell(xml: string, ref: string, value: Value): string {
  const re = new RegExp(`<c r="${ref}"((?:\\s[^>]*?)?)(?:/>|>[\\s\\S]*?</c>)`);
  if (!re.test(xml)) throw new Error(`ひな形にセル ${ref} が見つかりません`);
  return xml.replace(re, (_m, attrs: string) => {
    const a = attrs.replace(/\st="[^"]*"/, "");
    return typeof value === "number"
      ? `<c r="${ref}"${a}><v>${value}</v></c>`
      : `<c r="${ref}"${a} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  });
}

export async function fillOfficialWorkbook(template: Buffer, d: OfficialInput): Promise<Buffer> {
  const zip = await JSZip.loadAsync(template);
  const read = async (path: string) => {
    const f = zip.file(path);
    if (!f) throw new Error(`ひな形に ${path} がありません`);
    return f.async("string");
  };

  // 入力表（sheet1）
  let input = await read("xl/worksheets/sheet1.xml");
  if (d.submittedOn) input = setCell(input, "D6", serial(d.submittedOn));
  if (d.operatorAddress) input = setCell(input, "D7", d.operatorAddress);
  if (d.operatorName) input = setCell(input, "D8", d.operatorName);
  if (d.corporateNo) input = setCell(input, "D9", d.corporateNo);
  if (d.facilityAddress) input = setCell(input, "D10", d.facilityAddress);
  if (d.facilityName) input = setCell(input, "D11", d.facilityName);
  if (d.designationNo) input = setCell(input, "D12", d.designationNo);
  input = setCell(input, "E15", d.fiscalYear);
  input = setCell(input, "D16", serial(d.periodStart));
  input = setCell(input, "F16", serial(d.periodEnd));
  input = setCell(input, "D24", serial(d.dueDate));
  zip.file("xl/worksheets/sheet1.xml", input);

  // 月計表①②③（sheet2〜4）。1日が8行目、31日が38行目。C=2万円未満 D=2〜5万円 E=5万円以上 F=課税免除
  for (let i = 0; i < 3; i++) {
    const path = `xl/worksheets/sheet${i + 2}.xml`;
    let xml = await read(path);
    (d.months[i] ?? []).forEach((day, idx) => {
      const row = 8 + idx;
      if (day.t1) xml = setCell(xml, `C${row}`, day.t1);
      if (day.t2) xml = setCell(xml, `D${row}`, day.t2);
      if (day.t3) xml = setCell(xml, `E${row}`, day.t3);
      if (day.exempt) xml = setCell(xml, `F${row}`, day.exempt);
    });
    zip.file(path, xml);
  }

  // 計算式の保存済みの計算結果（ひな形の空欄時の値）を捨て、どのアプリで開いても計算し直させる
  for (let i = 1; i <= 6; i++) {
    const path = `xl/worksheets/sheet${i}.xml`;
    const xml = await read(path);
    zip.file(path, xml.replace(/(<f(?:\s[^>]*)?(?:\/>|>[^<]*<\/f>))<v>[^<]*<\/v>/g, "$1"));
  }

  // 開いたときに申告書・納入書の計算式を必ず再計算させる
  const wb = await read("xl/workbook.xml");
  zip.file("xl/workbook.xml", wb.replace(/<calcPr ([^>]*?)\/>/, (_m, a: string) => `<calcPr ${a} fullCalcOnLoad="1"/>`));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
