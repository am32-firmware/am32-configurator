<template>
  <DashboardLayout>
    <UDashboardPanel>
      <UDashboardNavbar class="grid grid-cols-12 text-white ">
        <div class="col-span-2 flex justify-center items-center">
          <svgo-logo-full class="text-white text-[150px]" />
        </div>
        <div class="col-span-8 h-[200px] max-h-[200px]">
          <div class="h-full font-bold text-3xl text-red-800 flex flex-col">
            <div v-if="logStore.entries.length === 0">
              AlkaMotors
            </div>

            <Log v-else class="h-full overflow-auto" />
          </div>
        </div>
        <div v-if="serialStore.hasSerial" class="col-span-2">
          <SerialDevice />
        </div>
      </UDashboardNavbar>
      <UFooter class="bg-gray-800">
        <template #left>
          <div class="text-center">
            AM32 Configurator
          </div>
        </template>
        <template>
          <div class="text-center">
            powered by Nuxt and Netlify
          </div>
        </template>
        <template #right>
          <div class="text-center">
            v0.0.1
          </div>
        </template>
      </UFooter>
    </UDashboardPanel>
    <slot />
  </DashboardLayout>
</template>
<script setup lang="ts">
const serialStore = useSerialStore();
const logStore = useLogStore();
</script>
