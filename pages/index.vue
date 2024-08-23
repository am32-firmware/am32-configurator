<template>
  <div>
    <div>
      <div class="p-4 max-w-[1400px] mx-auto pb-16">
        <div class="flex flex-col gap-4">
          <UCard>
            <div class="container">
              <h1 class="text-3xl font-bold mb-4">
                Active financial supporters
              </h1>
              <div class="flex justify-center gap-4">
                <a class="border border-black bg-black rounded-lg overflow-hidden p-4" href="https://store.airbot.racing/" target="_blank">
                  <img class="grayscale invert max-h-[100px] h-auto" src="https://store.airbot.racing/cdn/shop/files/Airbot_Logo.jpg">
                </a>
                <a class="border border-black bg-black rounded-lg overflow-hidden p-4" href="https://skystars-rc.com/" target="_blank">
                  <img class="grayscale invert max-h-[100px] h-auto" src="https://skystars-rc.com/wp-content/uploads/2022/09/logo1.png">
                </a>
                <a class="border border-black bg-black rounded-lg overflow-hidden p-4" href="https://holybro.com/" target="_blank">
                  <img class="grayscale invert max-h-[100px] h-auto" src="~/assets/logos/holybro.png">
                </a>
              </div>
            </div>
          </UCard>
          <UCard>
            <div class="container">
              <h1 class="text-3xl font-bold mb-4">
                AM32 MultiRotor ESC Firmware
              </h1>
              <p class="text-lg mb-8">
                Specialized firmware for speed controllers, designed for
                multirotor enthusiasts.
              </p>

              <div class="mb-8">
                <h2 class="text-2xl font-bold mb-4">
                  Key Features
                </h2>
                <ul class="list-disc list-inside">
                  <li class="mb-2">
                    Firmware Upgradeability: Seamless updates via Betaflight passthrough.
                  </li>
                  <li class="mb-2">
                    Motor Protocol Support: Compatible with Servo PWM and Dshot (300, 600) motor protocols.
                  </li>
                  <li class="mb-2">
                    Bi-directional Dshot: Enhance control and telemetry with bidirectional communication support.
                  </li>
                  <li class="mb-2">
                    Telemetry Support: Betaflight ESC telemetry, KISS standard ESC telemetry.
                  </li>
                  <li class="mb-2">
                    Variable PWM Frequency: Customize PWM frequency for precise motor control.
                  </li>
                  <li class="mb-2">
                    Sinusoidal Startup Mode: Smooth acceleration for larger motors.
                  </li>
                </ul>
              </div>

              <div class="mb-8">
                <h2 class="text-2xl font-bold mb-4">
                  Firmware Release & Configuration
                </h2>
                <p class="mb-4">
                  Stay updated with the latest firmware releases and configure settings using the
                  Multi_ESC config tool and Betaflight passthrough. Alternatively, use the Online-ESC Configurator for
                  web-based flashing and configuration adjustments.
                </p>
                <p class="mb-4">
                  Visit the <a href="#">latest release</a> for firmware updates.
                </p>
                <p>Download the Multi_ESC config tool under the <NuxtLink class="underline text-green-400" to="/downloads">Downloads</NuxtLink> section.</p>
              </div>

              <div class="mb-8">
                <h2 class="text-2xl font-bold mb-4">
                  Support & Community
                </h2>
                <p class="mb-4">
                  Join the discord server for support and community interaction.
                </p>
                <UButton
                  to="https://discord.com/invite/h7ddYMmEVV"
                  target="_blank"
                  icon="i-mdi-discord"
                  variant="outline"
                  color="blue"
                >
                  Join Discord
                </UButton>
              </div>

              <div class="">
                <h2 class="text-2xl font-bold mb-4">
                  Contributors
                </h2>
                <p class="">
                  A big thanks to all contributors, developers, and pilots who have contributed time,
                  advice, and code to the AM32 project.
                </p>
              </div>
            </div>
          </UCard>
          <UCard>
            <template #header>
              <div class="text-center text-xl font-bold text-green-500">
                Support
              </div>
            </template>
            <div class="text-center">
              Running and maintaining projects like ours requires continuous effort and resources. If you find our work valuable and would like to support us, consider becoming a patron on Patreon or making a one-time contribution via PayPal.
            </div>
            <template #footer>
              <div class="flex justify-center gap-4 text-4xl">
                <NuxtLink
                  to="https://www.patreon.com/user?u=44228479"
                  target="_blank"
                  external
                  class="transition-all hover:text-red-400"
                >
                  <UIcon name="i-mdi-patreon" />
                </NuxtLink>
                <!--<NuxtLink
                  to="https://www.patreon.com/user?u=44228479"
                  target="_blank"
                  external
                  class="transition-all hover:text-blue-400"
                >
                  <UIcon name="i-mdi-paypal" />
                </NuxtLink>-->
              </div>
            </template>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
</script>
