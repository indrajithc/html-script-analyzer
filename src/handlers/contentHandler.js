import path from "path";
import config from "../config";
import fs from "fs";
import { JSDOM } from "jsdom";

const { contentDirectory } = config;


export const handleContentRequest = async (req) => {
  const { pathname } = new URL(req.url);

  const fileName = pathname.split("/").pop();
  const filePath = path.join(contentDirectory, fileName);

  console.log("filePath", filePath);

  if (!fs.existsSync(filePath)) {
    return new Response("File not found", { status: 404 });
  }

  const content = fs.readFileSync(filePath, "utf-8");

  const dom = new JSDOM(content);
  const { document } = dom.window;

  const html = document.documentElement.outerHTML;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
};
