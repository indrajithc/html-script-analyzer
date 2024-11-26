import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

const port = process.env.PORT || 9833;

const rootDirectory = process.cwd();

const contentDirectory = path.join(rootDirectory, "data");
const contentConfigDirectory = path.join(contentDirectory, "config");

if (!fs.existsSync(contentDirectory)) {
  fs.mkdirSync(contentDirectory);
}

if (!fs.existsSync(contentConfigDirectory)) {
  fs.mkdirSync(contentConfigDirectory);
}

export const staticHeaders = `
 <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
`;

export default { port, contentDirectory, contentConfigDirectory };
