import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Transparent-friendly default codec; CLI flags override per render.
Config.setConcurrency(null);
