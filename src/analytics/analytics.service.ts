import * as _isEmpty from 'lodash/isEmpty'
import * as _filter from 'lodash/filter'
import * as _size from 'lodash/size'
import * as _isNull from 'lodash/isNull'
import * as _map from 'lodash/map'
import * as _keys from 'lodash/keys'
import * as dayjs from 'dayjs'
import * as utc from 'dayjs/plugin/utc'
import { ForbiddenException, Injectable, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { Pagination, PaginationOptionsInterface } from '../common/pagination'
import { Analytics } from './entities/analytics.entity'
import { PageviewsDTO } from './dto/pageviews.dto'
import { ProjectService } from '../project/project.service'
import { TimeBucketType } from './dto/getData.dto'

dayjs.extend(utc)

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Analytics)
    private analyticsRepository: Repository<Analytics>,
    private readonly projectService: ProjectService,
  ) { }

  // async paginate(options: PaginationOptionsInterface, where: Record<string, unknown> | undefined): Promise<Pagination<Analytics>> {
  //   const [results, total] = await this.analyticsRepository.findAndCount({
  //     take: options.take || 10,
  //     skip: options.skip || 0,
  //     where: where,
  //     order: {
  //       name: 'ASC',
  //     }
  //   })

  //   return new Pagination<Analytics>({
  //     results,
  //     total,
  //   })
  // }

  count(): Promise<number> {
    return this.analyticsRepository.count()
  }

  async create(project: PageviewsDTO | Analytics): Promise<PageviewsDTO | Analytics> {
    return this.analyticsRepository.save(project)
  }

  async update(id: string, eventsDTO: PageviewsDTO): Promise<any> {
    return this.analyticsRepository.update(id, eventsDTO)
  }

  async delete(id: string): Promise<any> {
    return this.analyticsRepository.delete(id)
  }

  findOne(id: string): Promise<Analytics | null> {
    return this.analyticsRepository.findOne(id)
  }

  findOneWhere(where: Record<string, unknown>): Promise<Analytics> {
    return this.analyticsRepository.findOne({ where })
  }

  findWhere(where: Record<string, unknown>): Promise<Analytics[]> {
    return this.analyticsRepository.find({ where })
  }

  async validate(logDTO: PageviewsDTO): Promise<string | null> {
    const errors = []
    if (_isEmpty(logDTO)) errors.push('The request cannot be empty')
    if (_isEmpty(logDTO.pid)) errors.push('The Project ID (pid) has to be provided')

    const project = await this.projectService.findOne(logDTO.pid)
    if (_isEmpty(project)) errors.push('The provided Project ID (pid) is incorrect')

    if (!_isEmpty(errors)) {
      throw new BadRequestException(errors)
    }

    return null
  }

  processData(data: object): object {
    const res = {
      tz: {},
      pg: {}, 
      lc: {},
      ref: {},
      sw: {},
      so: {}, 
      me: {},
      ca: {}, 
      lt: {},
    }
    const whitelist = _keys(res)
  
    for (let i = 0; i < _size(data); ++i) {
      const tfData = data[i].data
      for (let j = 0; j < _size(tfData); ++j) {
        for (let z = 0; z < _size(whitelist); ++z) {
          const currWLItem = whitelist[z]
          const tfDataRecord = tfData[j][currWLItem]
          if (!_isNull(tfDataRecord)) {
            res[currWLItem][tfDataRecord] = 1 + (res[currWLItem][tfDataRecord] || 0)
          }
        }
      }
    }
  
    return res
  }

  // TODO: Refactor; check if there's no date/time shifts
  async groupByTimeBucket(data: Analytics[], timeBucket: TimeBucketType, from: string, to: string): Promise<object | void> {
    const a = Math.random()
    console.time('groupByTimeBucket' + a)

    if (_isEmpty(data)) return Promise.resolve()
    let groupDateIterator
    let clone = [...data]
    const res = []

    const now = dayjs.utc().endOf(timeBucket)
    const djsTo = dayjs.utc(to).endOf(timeBucket)
    const iterateTo = djsTo > now ? now : djsTo

    switch (timeBucket) {
      case TimeBucketType.MINUTE:
        groupDateIterator = dayjs.utc(from).startOf('minute')
        break

      case TimeBucketType.HOUR:
        groupDateIterator = dayjs.utc(from).startOf('hour')
        break

      case TimeBucketType.DAY:
      case TimeBucketType.WEEK:
      case TimeBucketType.MONTH:
      case TimeBucketType.YEAR:
        groupDateIterator = dayjs.utc(from).startOf('day')
        break

      default:
        return Promise.reject()
    }

    // the database has to use UTC timezone for this to work normally
    while (groupDateIterator < iterateTo) {
      const nextIteration = groupDateIterator.add(1, timeBucket)
      const temp = []
      
      clone = _filter(clone, el => {
        const createdAt = dayjs.utc(el.created)
        if (groupDateIterator <= createdAt && createdAt < nextIteration) {
          temp.push(el)
          return false
        } else {
          return true
        }
      })

      res.push({
        data: temp,
        total: _size(temp),
        timeFrame: groupDateIterator.format('YYYY-MM-DD HH:mm:ss'),
      })
      groupDateIterator = nextIteration
    }

    const b = {
      params: this.processData(res),
      chart: {
        x: _map(res, el => el.timeFrame),
        visits: _map(res, el => el.total),
      },
    }
    console.timeLog('groupByTimeBucket' + a)
    return Promise.resolve({
      params: this.processData(res),
      chart: {
        x: _map(res, el => el.timeFrame),
        visits: _map(res, el => el.total),
      },
    })
  }
}
