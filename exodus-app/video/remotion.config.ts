// Remotion settings for the CLI (`remotion studio` and `remotion render`).
// See https://www.remotion.dev/docs/config
import { Config } from '@remotion/cli/config'

// JPEG frames render faster than PNG and we have no transparency.
Config.setVideoImageFormat('jpeg')
// H.264 MP4: plays everywhere (YouTube, X, the judges' laptops).
Config.setCodec('h264')
// Overwrite out/exodus-explainer.mp4 on every render.
Config.setOverwriteOutput(true)
