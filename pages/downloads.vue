<template>
  <div>
    <div class="p-4 max-w-[1400px] m-auto">
      <div v-if="status === 'pending'" class="text-4xl text-center text-red-500 p-5">
        <UIcon name="i-svg-spinners-blocks-wave" />
      </div>
      <div v-else-if="links">
        <UInput
          v-model="filter"
          class="mb-4"
          placeholder="Highlight..."
          icon="i-material-symbols-filter-alt"
          :ui="{ icon: { trailing: { pointer: '' } } }"
          autocomplete="off"
        >
          <template #trailing>
            <UButton
              v-show="filter !== ''"
              color="gray"
              variant="link"
              icon="i-heroicons-x-mark-20-solid"
              :padded="false"
              @click="filter = ''"
            />
          </template>
        </UInput>
        <UAccordion :items="rootFolders" multiple>
          <template #releases_data>
            <div v-if="getFolder('releases').value" class="p-4">
              <UAccordion color="teal" :items="getChildrenFolder(getFolder('releases').value)" variant="outline" size="sm">
                <template #files="{ item }">
                  <div class="grid grid-cols-4">
                    <div v-for="file of item.files" :key="file" class="py-1">
                      <ULink
                        :to="getFileLink(file)"
                        external
                        :download="file.name"
                        class="transition-all hover:text-red-500"
                        :class="{
                          'text-gray-500/20': filter && !file.name.toLowerCase().includes(filter.toLowerCase()),
                          'text-red-500': filter && file.name.toLowerCase().includes(filter.toLowerCase())
                        }"
                      >
                        {{ file.name }}
                      </ULink>
                    </div>
                  </div>
                </template>
              </UAccordion>
            </div>
            <div v-else>
              No releases
            </div>
          </template>
          <template #kiss-ultra-releases_data>
            <div v-if="getFolder('kiss-ultra-releases').value" class="p-4">
              <div v-if="getFolder('kiss-ultra-releases').value?.files?.length" class="grid grid-cols-4 mb-4">
                <div v-for="file of getFolder('kiss-ultra-releases').value?.files ?? []" :key="file.url" class="py-1">
                  <ULink
                    :to="getFileLink(file)"
                    external
                    :download="file.name"
                    class="transition-all hover:text-red-500"
                    :class="{
                      'text-gray-500/20': filter && !file.name.toLowerCase().includes(filter.toLowerCase()),
                      'text-red-500': filter && file.name.toLowerCase().includes(filter.toLowerCase())
                    }"
                  >
                    {{ file.name }}
                  </ULink>
                </div>
              </div>
              <UAccordion
                v-if="getChildrenFolder(getFolder('kiss-ultra-releases').value).length"
                color="teal"
                :items="getChildrenFolder(getFolder('kiss-ultra-releases').value)"
                variant="outline"
                size="sm"
              >
                <template #files="{ item }">
                  <div class="grid grid-cols-4">
                    <div v-for="file of item.files" :key="file" class="py-1">
                      <ULink
                        :to="getFileLink(file)"
                        external
                        :download="file.name"
                        class="transition-all hover:text-red-500"
                        :class="{
                          'text-gray-500/20': filter && !file.name.toLowerCase().includes(filter.toLowerCase()),
                          'text-red-500': filter && file.name.toLowerCase().includes(filter.toLowerCase())
                        }"
                      >
                        {{ file.name }}
                      </ULink>
                    </div>
                  </div>
                </template>
              </UAccordion>
            </div>
            <div v-else>
              No KISS Ultra firmware
            </div>
          </template>
          <template #tools_data>
            <div v-if="getFolder('tools').value" class="p-4">
              <div class="grid grid-cols-4">
                <div v-for="file of getFolder('tools').value?.files ?? []" :key="file.url" class="py-1">
                  <ULink
                    :to="getFileLink(file)"
                    external
                    :download="file.name"
                    class="transition-all hover:text-green-500"
                    :class="{
                      'text-gray-500/20': filter && !file.name.toLowerCase().includes(filter.toLowerCase()),
                      'text-red-500': filter && file.name.toLowerCase().includes(filter.toLowerCase())
                    }"
                  >
                    {{ file.name }}
                  </ULink>
                </div>
              </div>
            </div>
          </template>
          <template #bootloader_data>
            <div v-if="getFolder('bootloader').value" class="p-4">
              <UAccordion color="teal" :items="getChildrenFolder(getFolder('bootloader').value)" variant="outline" size="sm">
                <template #files="{ item }">
                  <div class="grid grid-cols-4">
                    <div v-for="file of item.files" :key="file" class="py-1">
                      <ULink
                        :to="getFileLink(file)"
                        external
                        :download="file.name"
                        class="transition-all hover:text-red-500"
                        :class="{
                          'text-gray-500/20': filter && !file.name.toLowerCase().includes(filter.toLowerCase()),
                          'text-red-500': filter && file.name.toLowerCase().includes(filter.toLowerCase())
                        }"
                      >
                        {{ file.name }}
                      </ULink>
                    </div>
                  </div>
                </template>
              </UAccordion>
            </div>
          </template>
          <template #unlocker_data>
            <div v-if="getFolder('unlocker').value" class="p-4">
              <UAccordion color="teal" :items="getChildrenFolder(getFolder('unlocker').value)" variant="outline" size="sm">
                <template #files="{ item }">
                  <div class="grid grid-cols-4">
                    <div v-for="file of item.files" :key="file" class="py-1">
                      <ULink
                        :to="getFileLink(file)"
                        external
                        :download="file.name"
                        class="transition-all hover:text-red-500"
                        :class="{
                          'text-gray-500/20': filter && !file.name.toLowerCase().includes(filter.toLowerCase()),
                          'text-red-500': filter && file.name.toLowerCase().includes(filter.toLowerCase())
                        }"
                      >
                        {{ file.name }}
                      </ULink>
                    </div>
                  </div>
                </template>
              </UAccordion>
            </div>
          </template>
        </UAccordion>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { data, status } = await useLazyFetch('/api/files?prereleases');

const filter = ref('');

const sectionLabels: Record<string, string> = {
    releases: 'RELEASES',
    'kiss-ultra-releases': 'KISS ULTRA RELEASES',
    bootloader: 'BOOTLOADER',
    tools: 'TOOLS',
    unlocker: 'UNLOCKER'
};

watchEffect(() => {
    if (status.value !== 'pending' && data.value) {
        links.value = data.value.data;
        rootFolders.value = data.value.data.map((folder) => {
            return {
                label: sectionLabels[folder.name ?? ''] ?? folder.name?.toUpperCase() ?? 'ERROR',
                slot: `${folder.name}_data`
            };
        });
    }
});

const links = ref<BlobFolder[]>([]);
const rootFolders = ref<{
  label: string,
  slot: string
}[]>([]);

const getFolder = (name: string) => computed(() => {
    return data.value?.data.find(b => b.name === name) ?? null;
});

const getChildrenFolder = (folder?: BlobFolder | null) => {
    return folder?.children
        .map(f => ({
            label: f.name,
            slot: 'files',
            files: f.files.filter(f => f.name.toLowerCase())
        }))
        .sort((a, b) => b.label.localeCompare(a.label)) ?? [];
};

const getFileLink = (file: BlobFolderFile) => {
    return file.downloadUrl ?? file.url;
};
</script>
