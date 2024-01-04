type LogMessageType = undefined | null | 'warning' | 'error'
type LogMessage = [Date, string, LogMessageType]
type SerialStore = ReturnType<typeof useSerialStore>
type LogStore = ReturnType<typeof useLogStore>
interface MspData {
    type: 'bf' | 'qs' | 'kiss' | null,
    protocol_version: number
    api_version: string,
    batteryData: {
        cellCount: number,
        capacity: number,
        voltage: number,
        drawn: number,
        amps: number
    } | null,
    motorCount: number
}