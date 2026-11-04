import { Module } from "@medusajs/framework/utils";
import service from "./service";
export const MEGAMENU = "megamenu";
export default Module(MEGAMENU, { service });
