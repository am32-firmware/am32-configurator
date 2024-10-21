<template>
  <div v-if="isStatic" class="flex flex-wrap justify-center items-center gap-6">
    <div v-for="e of randomImages" :key="e.url">
      <a class="block ring ring-red-600 bg-red-800/20 transition-all hover:bg-red-600/40 hover:scale-105 rounded-lg overflow-hidden p-4" :href="e.url" target="_blank">
        <img class="grayscale max-h-[50px] w-auto" :class="e.class" :src="e.path" :alt="e.url">
      </a>
    </div>
  </div>
  <div v-else class="flex justify-center gap-4 relative">
    <div class="absolute top-[-50px] right-[5px] p-4">
      <div class="absolute top-0 rounded-full w-[20px] h-[20px] bg-gray-950" />
      <div
        class="absolute top-0 rounded-full w-[20px] h-[20px] bg-red-900 scale-0 transition-all ease-linear"
        :class="{
          'duration-200': currentStep === -1,
          'duration-1000': currentStep > -1
        }"
        :style="{
          transform: 'scaleX('+ ((currentStep + 1) * 1000) / intervalTime +') scaleY('+ ((currentStep + 1) * 1000) / intervalTime +')'
        }"
      />
    </div>
    <XyzTransitionGroup
      appear
      xyz="fade small stagger"
      :duration="{ appear: 'auto', in: 'auto', out: 0 }"
      class="w-full flex flex-wrap justify-evenly gap-4"
    >
      <a v-for="e of imagePage" :key="e.url" class="ring ring-red-600 bg-red-800/20 transition-all hover:bg-red-600/40 hover:scale-105 rounded-lg overflow-hidden p-4" :href="e.url" target="_blank">
        <img class="grayscale h-[50px] w-auto" :class="e.class" :src="e.path" :alt="e.url">
      </a>
    </XyzTransitionGroup>
  </div>
</template>
<script setup lang="ts">
interface ImageSpinnerImage {
    path: string;
    url: string;
    class?: string;
}

interface ImageSpinnerProps {
    images: ImageSpinnerImage[];
    rotationTime?: number;
}

const props = withDefaults(defineProps<ImageSpinnerProps>(), {
    images: () => [],
    rotationTime: 5
});

const pageSize = 4;

const isStatic = computed(() => props.images.length < (pageSize + 1));

const randomImages: ImageSpinnerImage[] = shuffle(props.images);

const intervalTime = 5000;
const currentPage = ref(0);
const currentStep = ref(0);

useIntervalFn(() => {
    if ((currentStep.value + 1) % pageSize === 0) {
        if ((++currentPage.value * pageSize) >= props.images.length) {
            currentPage.value = 0;
        }
        currentStep.value = -1;
        useTimeoutFn(() => {
            currentStep.value = 0;
        }, 300);
    } else {
        currentStep.value++;
    }
}, intervalTime / 5);

const imagePage = computed<ImageSpinnerImage[]>(() => randomImages.slice(currentPage.value * pageSize, currentPage.value * pageSize + pageSize));
</script>
