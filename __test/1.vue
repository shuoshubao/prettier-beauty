<template>
    <Layout>
        <div slot="content">
            <div class="h3 text-wrap">
                <img class="logo" :src="logo" alt="">
                <span class="title-sm" v-if="!pageData.isPhone">{{pageData.projectTitle}}</span>
                <div class="title-bg" v-if="pageData.isPhone">{{pageData.projectTitle}}</div>
            </div>
            <div class="slogan">便捷 · 品质 · 生活</div>
        </div>
        <el-pagination :page-size="20" :current-page="currentPage" :total="total" @current-change="changePage" v-if="total" />
    </Layout>
</template>
