import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [, , version, buildArgument, dateArgument] = process.argv;
const build = Number(buildArgument);

if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error("Informe uma versão válida. Ex.: 0.1.0-alpha.23");
}
if (!Number.isInteger(build) || build < 1) {
  throw new Error("Informe uma build inteira e positiva.");
}

const now = new Date();
const localDate = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0")
].join("-");
const releasedAt = dateArgument || localDate;

if (!/^\d{4}-\d{2}-\d{2}$/.test(releasedAt)) {
  throw new Error("Informe a data no formato AAAA-MM-DD.");
}

const source = `(function defineFitBodyStatVersion(scope) {
  scope.FITBODYSTAT_VERSION = Object.freeze({
    version: "${version}",
    build: ${build},
    releasedAt: "${releasedAt}"
  });
}(globalThis));
`;

await writeFile(resolve("public/js/config/app-version.js"), source, "utf8");
console.log(`FitBodyStat ${version} (build ${build}) preparado para publicação.`);
