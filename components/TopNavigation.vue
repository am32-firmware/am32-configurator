<template>
  <!--<nav class="w-full border-b border-t flex justify-center">
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
    <div
      class="py-4 transition-all hover:bg-slate-900 relative text-xl w-fit block after:block after:content-[''] after:bottom-0 after:absolute after:h-[3px] after:bg-white after:w-full after:scale-x-0 after:hover:scale-x-100 after:transition after:duration-300 after:origin-center"
    >
      <NuxtLink active-class="!bg-slate-800" class="p-4 transition-all bg-transparent" to="/tools/downloads">
        Downloads
      </NuxtLink>
    </div>
  </nav>-->
  <div class="w-full">
    <UHorizontalNavigation
      :ui="{
        wrapper: 'relative w-full flex items-center justify-center gap-4',
      }"
      :links="links"
      class="text-center border-b border-gray-200 dark:border-gray-800"
    />
  </div>
</template>
<script setup lang="ts">
const escStore = useEscStore();

// const route = useRoute();
const links = computed(() => [{
    label: escStore.count > 0 ? 'Configurator' : 'AM32',
    icon: escStore.count > 0 ? 'i-heroicons-cpu-chip-16-solid' : 'i-heroicons-home',
    to: '/'
}, {
    label: 'Downloads',
    icon: 'i-material-symbols-download-rounded',
    to: '/downloads'
}]);
</script>
