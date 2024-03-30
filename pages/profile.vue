<template>
  <div class="p-4 max-w-[1400px] m-auto">
    <div v-if="!isAuthenticated" class="p-16 text-center">
      <UIcon class="h-[100px] w-[100px]" name="i-svg-spinners-blocks-wave" dynamic />
    </div>
    <div v-else class="flex flex-col gap-4">
      <div class="flex items-center justify-center gap-6">
        <div v-if="user?.picture">
          <img :src="user.picture" class="max-h-[50px] w-auto">
        </div>
        <div>Hello {{ auth.user.value?.nickname }}</div>
      </div>
      <UCard>
        <template #header>
          Saved configs
        </template>
        <div class="grid grid-cols-3">
          <div>Name</div>
          <div>Download</div>
          <div>Apply</div>
        </div>
      </UCard>
      <UCard>
        <template #header>
          Tunes
        </template>
        <div>
          <div class="grid grid-cols-3">
            <div>Name</div>
            <div>Download</div>
            <div>Apply</div>
          </div>
        </div>
      </UCard>
      <div>
        <UButton color="red" variant="ghost" @click="auth.logout()">
          Logout
        </UButton>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';
import { computed } from 'vue';

definePageMeta({
    middleware: ['auth']
});

const auth = useAuth0();

const isAuthenticated = computed(() => auth.isAuthenticated.value);

const user = computed(() => auth.user?.value);

console.log(auth);
</script>
