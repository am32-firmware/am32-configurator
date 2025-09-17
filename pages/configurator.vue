<template>
  <div>
    <div>
      <div v-if="!serialStore.hasSerial">
        <div class="text-3x text-red-500">
          WebSerial not supported! Please use other browser!
        </div>
      </div>
      <div v-else-if="escStore.count === 0">
        <div class="text-xl p-6 text-center text-orange-500">
          Please connect to a device and read settings.
        </div>
      </div>
      <div v-else-if="serialStore.isFourWay || serialStore.isDirectConnect" class="pt-4 pb-12 h-full">
        <UTabs
          :items="tabs"
        >
          <template v-if="(escStore.firstValidEscData?.data.settings?.LAYOUT_REVISION as number) < 3" #tune>
            <div class="pt-4 flex flex-col gap-4">
              <div class="flex gap-4 w-full justify-center">
                <div v-for="(info, n) of escStore.escData" :key="n">
                  <EscView
                    :is-loading="info.isLoading"
                    :index="n"
                    :esc="info"
                    :mcu="info.data"
                    @change="onChange"
                    @toggle="onToggle"
                  />
                </div>
              </div>
              <div v-if="escStore.isLoading" class="flex justify-center items-center mt-20">
                <UIcon class="text-green-500 w-[80px] h-[80px]" name="i-svg-spinners-blocks-wave" dynamic />
              </div>
              <div v-else-if="escStore.selectedEscInfo.length > 0">
                <UCheckbox v-model="syncAllEscTunes" label="Sync all ESCs?" />
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div
                    v-for="n of escStore.selectedEscInfo.length"
                    :key="n"
                  >
                    <div>ESC {{ n }}</div>
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="STARTUP_MELODY"
                      :individual="syncAllEscTunes ? undefined : n - 1"
                      type="rtttl"
                      placeholder="RTTTL String"
                      :disabled="syncAllEscTunes ? n > 1 : false"
                      @change="onSettingsChange"
                    />
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template #settings>
            <div class="h-full pt-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full justify-center">
                <div v-for="(info, n) of escStore.escData" :key="n">
                  <EscView
                    :is-loading="info.isLoading"
                    :index="n"
                    :esc="info"
                    :mcu="info.data"
                    @change="onChange"
                    @toggle="onToggle"
                  />
                </div>
              </div>
              <div v-if="escStore.isLoading" class="flex justify-center items-center mt-20">
                <UIcon class="text-green-500 w-[80px] h-[80px]" name="i-svg-spinners-blocks-wave" dynamic />
              </div>
              <div v-else-if="escStore.selectedEscInfo.length > 0" class="p-4 max-w-[1400px] m-auto">
                <div class="flex flex-col gap-4 justify-center">
                  <SettingFieldGroup
                    class="w-1/2"
                    title="Essentials"
                    :eeprom-version="escStore.firstValidEscData?.data.settings.LAYOUT_REVISION as number"
                    :firmware-version="`${escStore.firstValidEscData?.data.settings.MAIN_REVISION}.${escStore.firstValidEscData?.data.settings.SUB_REVISION}`"
                    :cols="1"
                    :switches="[{
                      field: 'DISABLE_STICK_CALIBRATION',
                      name: 'Disable stick calibration',
                      minFirmwareVersion: 'v2.19'
                    }]"
                  >
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="ESC_PROTOCOL"
                      name="Protocol"
                      type="select"
                      :options="protocolOptions"
                      placeholder="Select input protocol"
                      help="Help text"
                      @change="onSettingsChange"
                    />
                  </SettingFieldGroup>
                  <SettingFieldGroup
                    title="Motor"
                    :eeprom-version="escStore.firstValidEscData?.data.settings.LAYOUT_REVISION as number"
                    :firmware-version="`${escStore.firstValidEscData?.data.settings.MAIN_REVISION}.${escStore.firstValidEscData?.data.settings.SUB_REVISION}`"
                    :cols="3"
                    :switches="[{
                      field: 'STUCK_ROTOR_PROTECTION',
                      name: 'Stuck rotor protection'
                    }, {
                      field: 'STALL_PROTECTION',
                      name: 'Stall protection'
                    }, {
                      field: 'USE_HALL_SENSORS',
                      name: 'Use hall sensors'
                    }, {
                      field: 'INTERVAL_TELEMETRY',
                      name: '30ms interval telemetry'
                    }, {
                      field: 'VARIABLE_PWM_FREQUENCY',
                      name: 'Variable PWM',
                      maxFirmwareVersion: 'v2.17'
                    }, {
                      field: 'COMPLEMENTARY_PWM',
                      name: 'Complementary PWM'
                    }, {
                      field: 'AUTO_ADVANCE',
                      name: 'Auto timing advance',
                      minFirmwareVersion: 'v2.16'
                    }]"
                    :radios="[{
                      field: 'VARIABLE_PWM_FREQUENCY',
                      name: 'PWM Type',
                      minFirmwareVersion: 'v2.18',
                      values: [{
                        name: 'Fixed',
                        value: 0
                      }, {
                        name: 'Variable',
                        value: 1
                      }, {
                        name: 'by RPM',
                        value: 2
                      }]
                    }]"
                    @change="onSettingsChange"
                  >
                    <SettingField
                      v-if="isInEEpromVersion(escStore.firstValidEscData?.data.settings.LAYOUT_REVISION as number, 3)"
                      :esc-info="escStore.selectedEscInfo"
                      field="TIMING_ADVANCE"
                      name="Timing advance"
                      type="number"
                      :min="0"
                      :max="32"
                      :step="1"
                      :display-factor="0.9375"
                      :offset="-10"
                      unit="°"
                      :disabled="(v: number) => escStore.firstValidEscData?.data.settings.AUTO_ADVANCE === 1"
                      @change="onSettingsChange"
                    />
                    <SettingField
                      v-else
                      :esc-info="escStore.selectedEscInfo"
                      field="TIMING_ADVANCE"
                      name="Timing advance"
                      type="number"
                      :min="0"
                      :max="22.5"
                      :step="7.5"
                      :display-factor="7.5"
                      unit="°"
                      :disabled="(v: number) => escStore.firstValidEscData?.data.settings.AUTO_ADVANCE === 1"
                      @change="onSettingsChange"
                    />
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="STARTUP_POWER"
                      name="Startup power"
                      type="number"
                      :min="50"
                      :max="150"
                      :step="1"
                      unit="%"
                      @change="onSettingsChange"
                    />
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="MOTOR_KV"
                      name="Motor KV"
                      type="number"
                      :min="20"
                      :max="10220"
                      :step="40"
                      :display-factor="40"
                      :offset="20"
                      show-value
                      @change="onSettingsChange"
                    />
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="MOTOR_POLES"
                      name="Motor poles"
                      type="number"
                      :min="2"
                      :max="36"
                      show-value
                      @change="onSettingsChange"
                    />
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="BEEP_VOLUME"
                      name="Beeper volume"
                      type="number"
                      :min="0"
                      :max="11"
                      show-value
                      @change="onSettingsChange"
                    />
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="PWM_FREQUENCY"
                      name="PWM Frequency"
                      type="number"
                      :min="8"
                      :max="isInEEpromVersion(escStore.firstValidEscData?.data.settings.LAYOUT_REVISION as number, 3) ? 144 : 48"
                      :step="1"
                      unit="kHz"
                      :disabled="(v: number) => (escStore.firstValidEscData?.data.settings.VARIABLE_PWM_FREQUENCY as number ?? 0) > 1"
                      @change="onSettingsChange"
                    >
                      <template #unit="{ value }">
                        <div v-if="escStore.firstValidEscData?.data.settings.VARIABLE_PWM_FREQUENCY === 1">
                          {{ value }}kHz - {{ value as number * 2 }}kHz
                        </div>
                        <div v-else>
                          {{ value }}kHz
                        </div>
                      </template>
                    </SettingField>
                  </SettingFieldGroup>
                  <SettingFieldGroup
                    v-if="isInEEpromVersion(escStore.firstValidEscData?.data.settings.LAYOUT_REVISION as number, 3)"
                    title="Extended settings"
                    :cols="3"
                  >
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="MAX_RAMP"
                      name="Ramp rate"
                      type="number"
                      :min=".1"
                      :max="20"
                      :step=".1"
                      unit="% duty cycle per ms"
                      :display-factor=".1"
                      show-value
                      @change="onSettingsChange"
                    />
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="MINIMUM_DUTY_CYCLE"
                      name="Minimum duty cycle"
                      type="number"
                      :min="0"
                      :max="25"
                      :step=".5"
                      unit="%"
                      :display-factor="0.5"
                      show-value
                      @change="onSettingsChange"
                    />
                  </SettingFieldGroup>
                  <SettingFieldGroup
                    title="Limits"
                    :cols="3"
                    :firmware-version="`${escStore.firstValidEscData?.data.settings.MAIN_REVISION}.${escStore.firstValidEscData?.data.settings.SUB_REVISION}`"
                    :switches="[{
                      field: 'LOW_VOLTAGE_CUTOFF',
                      name: 'Low voltage cut off',
                      maxFirmwareVersion: 'v2.18'
                    }]"
                    :radios="[{
                      field: 'LOW_VOLTAGE_CUTOFF',
                      name: 'Low voltage cut off',
                      minFirmwareVersion: 'v2.19',
                      values: [{
                        name: 'Off',
                        value: 0
                      }, {
                        name: 'Cell based',
                        value: 1
                      }, {
                        name: 'Absolute',
                        value: 2
                      }]
                    }]"
                    @change="onSettingsChange"
                  >
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="TEMPERATURE_LIMIT"
                      name="Temperature limit"
                      type="number"
                      :min="70"
                      :max="141"
                      :step="1"
                      :disabled-value="141"
                      show-value
                      @change="onSettingsChange"
                    />
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="CURRENT_LIMIT"
                      name="Current limit"
                      type="number"
                      :min="0"
                      :max="202"
                      :step="2"
                      :display-factor="2"
                      :disabled-value="202"
                      show-value
                      @change="onSettingsChange"
                    />
                    <SettingField
                      v-if="(escStore.firstValidEscData?.data.settings.LOW_VOLTAGE_CUTOFF as number) < 2"
                      :esc-info="escStore.selectedEscInfo"
                      field="LOW_VOLTAGE_THRESHOLD"
                      name="Low voltage cut off threshold"
                      type="number"
                      :min="250"
                      :max="350"
                      :step="1"
                      :offset="250"
                      :display-factor="1"
                      :disabled="(value: number) => escStore.firstValidEscData?.data.settings.LOW_VOLTAGE_CUTOFF === 0"
                      show-value
                      @change="onSettingsChange"
                    />
                    <SettingField
                      v-if="isInEEpromVersion(escStore.firstValidEscData?.data.settings.LAYOUT_REVISION as number, 3)
                        && (escStore.firstValidEscData?.data.settings.LOW_VOLTAGE_CUTOFF as number) === 2"
                      :esc-info="escStore.selectedEscInfo"
                      field="ABSOLUTE_VOLTAGE_CUTOFF"
                      name="Absolute voltage cutoff"
                      type="number"
                      :min="1"
                      :max="100"
                      :step="1"
                      :display-factor="0.5"
                      unit="V"
                      :disabled="(value: number) => escStore.firstValidEscData?.data.settings.LOW_VOLTAGE_CUTOFF !== 2"
                      show-value
                      @change="onSettingsChange"
                    />
                  </SettingFieldGroup>
                  <SettingFieldGroup
                    v-if="isInEEpromVersion(escStore.firstValidEscData?.data.settings.LAYOUT_REVISION as number, 3)"
                    title="Current control"
                    :cols="3"
                    :class="{
                      'before:content-[\'\'] before:absolute before:inset-0 blur-[2px]': (escStore.firstValidEscData?.data.settings.CURRENT_LIMIT as number) > 100
                    }"
                  >
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="CURRENT_P"
                      name="Current P"
                      type="number"
                      :min="0"
                      :max="255"
                      show-value
                      @change="onSettingsChange"
                    />
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="CURRENT_I"
                      name="Current I"
                      type="number"
                      :min="0"
                      :max="255"
                      show-value
                      @change="onSettingsChange"
                    />
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="CURRENT_D"
                      name="Current D"
                      type="number"
                      :min="0"
                      :max="255"
                      show-value
                      @change="onSettingsChange"
                    />
                  </SettingFieldGroup>
                  <SettingFieldGroup
                    title="Sinusoidal Startup"
                    :cols="2"
                    :switches="[{
                      field: 'SINUSOIDAL_STARTUP',
                      name: 'Sinusoidal startup'
                    }]"
                    @change="onSettingsChange"
                  >
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="SINE_MODE_RANGE"
                      name="Sine Mode Range"
                      type="number"
                      :min="5"
                      :max="25"
                      :disabled="(value: number) => escStore.firstValidEscData?.data.settings.SINUSOIDAL_STARTUP === 0 || escStore.firstValidEscData?.data.settings.RC_CAR_REVERSING !== 0"
                      show-value
                      @change="onSettingsChange"
                    />
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="SINE_MODE_POWER"
                      name="Sine Mode Power"
                      type="number"
                      :min="1"
                      :max="10"
                      :disabled="(value: number) => escStore.firstValidEscData?.data.settings.SINUSOIDAL_STARTUP === 0 || escStore.firstValidEscData?.data.settings.RC_CAR_REVERSING !== 0"
                      show-value
                      @change="onSettingsChange"
                    />
                  </SettingFieldGroup>
                  <SettingFieldGroup
                    title="Brake"
                    :cols="3"
                    :eeprom-version="escStore.firstValidEscData?.data.settings.LAYOUT_REVISION as number"
                    :firmware-version="`${escStore.firstValidEscData?.data.settings.MAIN_REVISION}.${escStore.firstValidEscData?.data.settings.SUB_REVISION}`"
                    :switches="[{
                      field: 'BRAKE_ON_STOP',
                      name: 'Brake on stop',
                      maxFirmwareVersion: 'v2.18'
                    }, {
                      field: 'RC_CAR_REVERSING',
                      name: 'Car type reverse breaking'
                    }]"
                    :radios="[{
                      field: 'BRAKE_ON_STOP',
                      name: 'Brake on stop',
                      minFirmwareVersion: 'v2.19',
                      values: [{
                        name: 'Off',
                        value: 0
                      }, {
                        name: 'Brake on stop',
                        value: 1
                      }, {
                        name: 'Active brake',
                        value: 2
                      }]
                    }]"
                    @change="onSettingsChange"
                  >
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      name="Brake strength"
                      type="number"
                      field="BRAKE_STRENGTH"
                      :min="1"
                      :max="10"
                      :step="1"
                      :disabled="(value: number) => escStore.firstValidEscData?.data.settings.BRAKE_ON_STOP === 0 || escStore.firstValidEscData?.data.settings.RC_CAR_REVERSING !== 0"
                      show-value
                      @change="onSettingsChange"
                    />
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      name="Running brake level"
                      type="number"
                      field="RUNNING_BRAKE_LEVEL"
                      :min="1"
                      :max="10"
                      :step="1"
                      :disabled="(value: number) => escStore.firstValidEscData?.data.settings.RC_CAR_REVERSING !== 0"
                      show-value
                      @change="onSettingsChange"
                    />
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      field="ACTIVE_BRAKE_POWER"
                      name="Active brake power"
                      type="number"
                      :min="0"
                      :max="5"
                      :step="1"
                      unit="%"
                      :disabled="(value: number) => escStore.firstValidEscData?.data.settings.BRAKE_ON_STOP !== 2"
                      @change="onSettingsChange"
                    >
                      <template #unit="{ value }">
                        {{ value === 0 ? 'Off' : `${value} % duty cycle` }}
                      </template>
                    </SettingField>
                  </SettingFieldGroup>
                  <SettingFieldGroup
                    title="Servo settings"
                    :cols="3"
                  >
                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      name="Low threshold"
                      type="number"
                      field="SERVO_LOW_THRESHOLD"
                      :min="750"
                      :max="1250"
                      :display-factor="2"
                      :offset="750"
                      show-value
                      @change="onSettingsChange"
                    />

                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      name="High threshold"
                      type="number"
                      field="SERVO_HIGH_THRESHOLD"
                      :min="1750"
                      :max="2250"
                      :display-factor="2"
                      :offset="1750"
                      show-value
                      @change="onSettingsChange"
                    />

                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      name="Neutral"
                      type="number"
                      field="SERVO_NEUTRAL"
                      :min="1374"
                      :max="1630"
                      :display-factor="1"
                      :offset="1374"
                      show-value
                      @change="onSettingsChange"
                    />

                    <SettingField
                      :esc-info="escStore.selectedEscInfo"
                      name="Dead band"
                      type="number"
                      field="SERVO_DEAD_BAND"
                      :min="0"
                      :max="100"
                      show-value
                      @change="onSettingsChange"
                    />
                  </SettingFieldGroup>
                </div>
              </div>
            </div>
          </template>
        </UTabs>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { EepromLayoutKeys } from '~/src/eeprom';

const serialStore = useSerialStore();
const escStore = useEscStore();

const syncAllEscTunes = ref(false);

const onChange = (payload: { index: number, field: EepromLayoutKeys, value: boolean }) => {
    escStore.escData[payload.index].data.settingsDirty = escStore.escData[payload.index].data.settings[payload.field] !== (payload.value ? 1 : 0);
    escStore.escData[payload.index].data.settings[payload.field] = (payload.value ? 1 : 0);
};

const onToggle = (index: number) => {
    if (escStore.escData[index].data) {
        escStore.escData[index].data.isSelected = !escStore.escData[index].data.isSelected;
    }
};

const isInEEpromVersion = (escEeepromVersion: number, minVersion?: number, maxVersion?: number) => {
    return escEeepromVersion >= (minVersion ?? 0) && escEeepromVersion <= (maxVersion ?? 999);
};

const tabs = computed(() => {
    const ret = [
        { label: 'Base', slot: 'settings', icon: 'i-material-symbols-settings' }
    ];
    if (escStore.firstValidEscData?.data.settings && escStore.firstValidEscData?.data.settings.LAYOUT_REVISION as number < 3) {
        ret.push({ label: 'Tune', slot: 'tune', icon: 'i-material-symbols-music-note' });
    }
    return ret;
});

const protocolOptions = [
    {
        value: 0,
        label: 'Auto'
    },
    {
        value: 1,
        label: 'DShot'
    },
    {
        value: 2,
        label: 'Servo'
    },
    {
        value: 3,
        label: 'Serial'
    },
    {
        value: 4,
        label: 'EDT ARM'
    }
];

const onSettingsChange = ({ field, value, individual }: { field: EepromLayoutKeys, value: number | number[], individual?: number }) => {
    if (individual !== undefined) {
        escStore.selectedEscInfo[individual].settings[field] = value;
        escStore.selectedEscInfo[individual].settingsDirty = true;
    } else {
        for (let i = 0; i < escStore.selectedEscInfo.length; ++i) {
            escStore.selectedEscInfo[i].settings[field] = value;
            escStore.selectedEscInfo[i].settingsDirty = true;
        }
    }
};
</script>
