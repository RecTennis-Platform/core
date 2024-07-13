// import { Readability } from '@mozilla/readability';
import fetch from 'node-fetch';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { load } from 'cheerio';
import { PrismaService } from 'src/prisma/prisma.service';
const NewsAPI = require('newsapi');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
import { extract } from 'article-parser';
import { Readability } from '@mozilla/readability';

@Injectable()
export class NewsCrawlerService {
  constructor(private readonly prismaService: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  async handleCron() {
    const newsapi = new NewsAPI(process.env.NEWS_API_KEY);
    const now = new Date();
    const toDate = now.toISOString();
    const fromDate = new Date(
      now.getTime() - 24 * 60 * 60 * 1000 * 30,
    ).toISOString();
    newsapi.v2
      .everything({
        q: 'tennis',
        sources: 'bbc-sport, bild, bleacher-report',
        from: fromDate,
        to: toDate,
        language: 'en',
        page: 1,
        pageSize: 30,
      })
      .then(async (response) => {
        if (response.status === 'ok') {
          console.log(response.articles);
          const news = (
            await Promise.all(
              response.articles.map(async (article) => {
                let content = '';
                const author =
                  article.author || 'https://www.facebook.com/bbcnews';
                await axios
                  .get(article.url)
                  .then(function (r2) {
                    // We now have the article HTML, but before we can use Readability to locate the article content we need jsdom to convert it into a DOM object
                    const dom = new JSDOM(r2.data, {
                      url: article.url,
                    });

                    // now pass the DOM document into readability to parse
                    const articleContent = new Readability(
                      dom.window.document,
                    ).parse();

                    // Done! The article content is in the textContent property
                    content = articleContent.textContent;
                  })
                  .catch(function (error) {
                    console.error('Error fetching article:');
                  });

                if (content.length > 2000) {
                  return {
                    image: article.urlToImage,
                    title: article.title,
                    description: article.description,
                    content: content,
                    createdAt: article.publishedAt,
                    author: author,
                  };
                }
              }),
            )
          ).filter(Boolean);
          console.log(news);
          await this.prismaService.news.createMany({
            data: news,
          });
        }
      });
  }
}
