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
              <div v-else-if="escStore.selectedEscInfo.length > 0" class="p-4 max-w-[1400px] m-auto">
                <div class="flex flex-col gap-4 justify-center">
                  <SettingFieldGroup class="w-[500px]" title="Essentials" :cols="1">
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
                      field: 'VARIABLE_PWM_FREQUENCY',
                      name: 'Variable PWM'
                    }, {
                      field: 'COMPLEMENTARY_PWM',
                      name: 'Complementary PWM'
                    }, {
                      field: 'AUTO_ADVANCE',
                      name: 'Auto timing advance',
                      minFirmwareVersion: 'v2.16'
                    }, {
                      field: 'VARIABLE_PWM_FREQUENCY',
                      name: 'PWM by RPM',
                      minFirmwareVersion: 'v2.18',
                      setValue: 2
                    }]"
                    @change="onSettingsChange"
                  >
                    <SettingField
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
                      :max="48"
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
                    title="Limits"
                    :cols="3"
                    :switches="[{
                      field: 'LOW_VOLTAGE_CUTOFF',
                      name: 'Low voltage cut off'
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
                      :esc-info="escStore.selectedEscInfo"
                      field="RAMP_RATE"
                      name="Ramp rate (ms)"
                      type="number"
                      :min="1"
                      :max="20"
                      :step="1"
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
                      name="Sine Mode Power"
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
                    :switches="[{
                      field: 'BRAKE_ON_STOP',
                      name: 'Brake on stop'
                    }, {
                      field: 'RC_CAR_REVERSING',
                      name: 'Car type reverse breaking'
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
            console.log(field, value, individual, escStore.selectedEscInfo[0].settings[field]);
        }
    }
};
</script>
