<template>
  <div>
    <div>
      <div v-if="!serialStore.hasSerial">
        <div class="text-3x text-red-500">
          WebSerial not supported! Please use other browser!
        </div>
      </div>
      <div v-else-if="serialStore.isFourWay || serialStore.isDirectConnect" class="pt-4 pb-12 h-full">
        <div v-if="serialStore.isFourWay || serialStore.isDirectConnect" class="h-full">
          <div class="flex gap-4 w-full justify-center">
            <div v-for="n of escStore.count" :key="n">
              <EscView
                :is-loading="!hasEsc(n - 1)"
                :index="n - 1"
                :esc="escStore.escData[n - 1]"
                :mcu="escStore.escInfo[n - 1]"
                @change="onChange"
                @toggle="onToggle"
              />
            </div>
          </div>
          <div v-if="allLoaded && escStore.selectedEscInfo.length > 0" class="p-4 max-w-[1400px] m-auto">
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
                  @change="onSettingsChange"
                >
                  <template #unit="{ value }">
                    <div v-if="escStore.selectedEscInfo[0].settings.VARIABLE_PWM_FREQUENCY === 1">
                      {{ value }}kHz - {{ value as number * 2 }}kHz
                    </div>
                    <div v-else>
                      {{ value }}
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
                  :disabled="(value: number) => escStore.selectedEscInfo[0].settings.LOW_VOLTAGE_CUTOFF === 0"
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
                  :disabled="(value: number) => escStore.selectedEscInfo[0].settings.SINUSOIDAL_STARTUP === 0"
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
                  :disabled="(value: number) => escStore.selectedEscInfo[0].settings.SINUSOIDAL_STARTUP === 0"
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
                  :disabled="(value: number) => escStore.selectedEscInfo[0].settings.BRAKE_ON_STOP === 0"
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
                  show-value
                  @change="onSettingsChange"
                />
              </SettingFieldGroup>
              <SettingFieldGroup
                title="Servo settings"
                :cols="3"
              >
                <SettingField
                  :esc-info="escStore.escInfo"
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
      </div>
      <div v-else>
        <nav class="w-full border-b border-t flex justify-center">
          <ContentNavigation v-slot="{ navigation }">
            <div
              v-for="link of navigation"
              :key="link._path"
              class="py-4 transition-all hover:bg-slate-900 relative text-xl w-fit block after:block after:content-[''] after:bottom-0 after:absolute after:h-[3px] after:bg-white after:w-full after:scale-x-0 after:hover:scale-x-100 after:transition after:duration-300 after:origin-center"
            >
              <NuxtLink active-class="!bg-slate-800" class="p-4 transition-all bg-transparent" :to="link._path">
                {{ link.title }}
              </NuxtLink>
            </div>
          </ContentNavigation>
        </nav>
        <div class="p-4 max-w-[1400px] m-auto prose prose-invert">
          <ContentDoc />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { EepromLayoutKeys } from '~/src/eeprom';

const serialStore = useSerialStore();
const escStore = useEscStore();

const hasEsc = (n: number) => {
    return !!escStore.escData[n] && !!escStore.escInfo[n];
};

const allLoaded = computed(() => escStore.escInfo.length > 0 && escStore.escInfo.length === escStore.count && !escStore.escData.find(e => e.isLoading === true));

const onChange = (payload: { index: number, field: EepromLayoutKeys, value: boolean }) => {
    escStore.escInfo[payload.index].settingsDirty = escStore.escInfo[payload.index].settings[payload.field] !== (payload.value ? 1 : 0);
    escStore.escInfo[payload.index].settings[payload.field] = (payload.value ? 1 : 0);
};

const onToggle = (index: number) => {
    escStore.escInfo[index].isSelected = !escStore.escInfo[index].isSelected;
};

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

const onSettingsChange = (payload: { field: EepromLayoutKeys, value: number }) => {
    for (let i = 0; i < escStore.selectedEscInfo.length; ++i) {
        escStore.selectedEscInfo[i].settings[payload.field] = payload.value;
        escStore.selectedEscInfo[i].settingsDirty = true;
    }
};
</script>
