// https://developers.google.com/media/vp9/settings/vod

const VodQuality = {
    UNWATCHABLE: 'UNWATCHABLE',
    TRASH: 'TRASH',
    EVEN_LOWER: 'EVEN_LOWER',
    LOWER: 'LOWER',
    LOW: 'LOW',
    DEFAULT: 'DEFAULT',
    BETTER: 'BETTER',
    TOO_GOOD: 'TOO_GOOD'
};

function getBitrate(options) {
    const listBuilder = (bitrate, minBitrate, maxBitrate) => {
        return [
            `-b:v ${bitrate}k`,
            `-minrate ${minBitrate}k`,
            `-maxrate ${maxBitrate}k`
        ]
    }

    switch (options.resolution) {
        case 144:
        case 240:
            return listBuilder(150, 75, 218)
        case 360:
            return listBuilder(276, 138, 400)
        case 480:
            // 512 (LQ), 750 (MQ) |	256 (LQ) 375 (MQ)	| 742 (LQ) 1088 (MQ)
            return listBuilder(512, 256, 742)
        case 720:
            return listBuilder(1024, 512, 1485)
        case 1080:
            return listBuilder(1800, 900, 2610)
        case 1440:
            return listBuilder(6000, 3000, 8700)
        case 2160:
            return listBuilder(12000, 6000, 17400)
        default:
            console.error(`getBitrate: UNKNOWN VIDEO RESOLUTION: ${options.resolution}; USING 144p AS FALLBACK`)
            return listBuilder(150, 75, 218)
    }
}

function getQuality(options) {
    const listBuilder = (crf) => {
        return [`-crf ${crf}`]
    }

    const qualityCalculator = (defaultCrf, selectedQuality) => {
        let qualityDict = {}
        qualityDict[VodQuality.LOW] = 1
        qualityDict[VodQuality.UNWATCHABLE] = 1
        qualityDict[VodQuality.TRASH] = 1
        qualityDict[VodQuality.EVEN_LOWER] = 1
        qualityDict[VodQuality.LOWER] = 1
        qualityDict[VodQuality.LOW] = 1
        qualityDict[VodQuality.DEFAULT] = 1
        qualityDict[VodQuality.BETTER] = 1
        qualityDict[VodQuality.TOO_GOOD] = 1

        let result = qualityDict[selectedQuality] * defaultCrf

        return Math.max(Math.min(defaultCrf, result), 0)
    }

    switch (options.resolution) {
        case 144:
        case 240:
            return listBuilder(37)
        case 360:
            return listBuilder(36)
        case 480:
            // 34 (LQ) or 33 (MQ)
            return listBuilder(34)
        case 720:
            return listBuilder(32)
        case 1080:
            return listBuilder(31)
        case 1440:
            return listBuilder(24)
        case 2160:
            return listBuilder(15)
        default:
            console.error(`getQuality: UNKNOWN VIDEO RESOLUTION: ${options.resolution}; USING 144p AS FALLBACK`)
            return listBuilder(37)
    }
}

function getTileColumns(options) {
    const listBuilder = (tiles, threads) => {
        return [
            `-tile-columns ${tiles}`,
            `-threads ${threads}`
        ]
    }

    switch (options.resolution) {
        case 144:
        case 240:
            return listBuilder(0, 2)
        case 360:
            return listBuilder(1, 2 * 2)
        case 480:
            return listBuilder(1, 2 * 2)
        case 720:
            return listBuilder(2, 2 * 2)
        case 1080:
            return listBuilder(2, 2 * 2)
        case 1440:
            return listBuilder(4, 4 * 4)
        case 2160:
            return listBuilder(4, 4 * 4)
        default:
            console.error(`getTileColumns: UNKNOWN VIDEO RESOLUTION: ${options.resolution}; USING 2160p AS FALLBACK`)
            return listBuilder(4, 4 * 4)
    }
}

function builderVodFun(options, store) {
    let outputOptions = []
    let targetFps = options.fps

    if (store['isFramerateCapped']) {
        targetFps = Math.min(options.fps, store['framerateCap'])
    }

    let keyFrameSpacing = store['keyFrameSpacing']

    outputOptions.push(`-r ${targetFps}`)
    outputOptions.push(`-g ${keyFrameSpacing}`)
    outputOptions.push(...getBitrate(options))
    outputOptions.push(...getQuality(options))
    outputOptions.push(...getTileColumns(options))

    return {
        outputOptions: outputOptions
    }
}

async function register({
                            registerSetting,
                            settingsManager,
                            transcodingManager
                        }) {
    const defaultKeyFrameSpacing = 240
    const defaultFramerateCap = 30
    const defaultIsFramerateCapped = true
    const defaultQuality = VodQuality.DEFAULT

    const store = {
        keyFrameSpacing: await settingsManager.getSetting('keyFrameSpacing') || defaultKeyFrameSpacing,
        framerateCap: await settingsManager.getSetting('framerateCap') || defaultFramerateCap,
        isFramerateCapped: await settingsManager.getSetting('isFramerateCapped') || defaultIsFramerateCapped,
        quality: await settingsManager.getSetting('quality') || defaultQuality,
        crf: await settingsManager.getSetting('crf') || defaultQuality,
    }

    const builderVOD = (options) => {
        return builderVodFun(options, store)
    }

    registerSetting({
        name: 'crf',
        label: 'Constant Rate Factor',
        type: 'select',
        options: [
            {label: 'Trash', value: VodQuality.TRASH},
            {label: 'Even lower', value: VodQuality.EVEN_LOWER},
            {label: 'Lower', value: VodQuality.LOWER},
            {label: 'Low', value: VodQuality.LOW},
            {label: 'Default', value: VodQuality.DEFAULT},
            {label: 'Better', value: VodQuality.BETTER},
            {label: 'Too good', value: VodQuality.TOO_GOOD},
        ],
        descriptionHTML: `
Use this rate control mode if you want to keep the best quality and care less about the file size.<br/>
<strong>Too good</strong> - you don't want this setting to be selected. Will consume too much space, encoding time and probably doesn't worth it;<br/>
<strong>Better</strong> - somewhat higher quality transcoding;<br/>
<strong>Default</strong> - the way Google described it in theirs article;<br/>
<strong>Low</strong> - when you want to save some space but want videos to be watchable;<br/>
<strong>Lower</strong> - more space, less watchable;<br/>
<strong>Even lower</strong> - almost unwatchable, but fast and space efficient;<br/>
<strong>Trash</strong> - if you feel like goofing around.
`,
        private: true,
        default: defaultQuality
    })

    registerSetting({
        name: 'keyFrameSpacing',
        label: 'Key frame spacing',
        type: 'input',
        descriptionHTML: `
It is recommended to allow up to 240 frames of video between keyframes (8 seconds for 30fps content).<br/>
Keyframes are video frames which are self-sufficient; they don't rely upon any other frames to render, but they tend to be larger than other frame types.<br/>
For web and mobile playback, generous spacing between keyframes allows the encoder to choose the best placement of keyframes to maximize quality.<br/>
<strong>INTEGERS ONLY. WILL RESET TO ${defaultKeyFrameSpacing} IF NOT INTEGER</strong>`,
        private: true,
        default: defaultKeyFrameSpacing,
    })

    registerSetting({
        name: 'isFramerateCapped',
        label: 'Cap video framerate',
        type: 'input-checkbox',
        descriptionHTML: `If checked, will cap framerate of video to value in plugin settings`,
        private: true,
        default: true,
    })

    registerSetting({
        name: 'framerateCap',
        label: 'Target video framerate',
        type: 'input',
        descriptionHTML: `Will cap video framerate if "Cap video framerate" is checked`,
        private: true,
        default: defaultFramerateCap,
    })

    let setParsedUIntOrDefault = (valueName, defaultValue, changedSettings) => {
        let changedValue = changedSettings[valueName].trim()
        let parsedValue = Number.parseInt(changedValue)

        if (!Number.isInteger(parsedValue) || parsedValue < 0) {
            console.error(`${valueName} is not a positive integer(${changedValue})! Setting it to ${defaultValue}`)

            parsedValue = defaultValue
        }

        store[valueName] = parsedValue

        settingsManager.setSetting(valueName, parsedValue.toString())
    }

    settingsManager.onSettingsChange(settings => {
        setParsedUIntOrDefault('keyFrameSpacing', defaultKeyFrameSpacing, settings)
        setParsedUIntOrDefault('framerateCap', defaultFramerateCap, settings)
    })

    const encoder = 'libvpx-vp9'
    const profileName = 'U2Be like VP9 transcoding'

    transcodingManager.addVODProfile(encoder, profileName, builderVOD)
    transcodingManager.addVODEncoderPriority('video', encoder, 1000)
    transcodingManager.addVODEncoderPriority('audio', 'libopus', 1000)
}

async function unregister() {
}

module.exports = {
    register,
    unregister
}
