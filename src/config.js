import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

const port = process.env.PORT || 9833;

const rootDirectory = process.cwd();

const contentDirectory = path.join(rootDirectory, "data");

if (!fs.existsSync(contentDirectory)) {
  fs.mkdirSync(contentDirectory);
}

export default { port, contentDirectory };